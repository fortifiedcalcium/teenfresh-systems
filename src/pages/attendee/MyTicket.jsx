import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient.js";
import { callFunction } from "../../lib/api.js";
import TicketCard from "../../components/TicketCard.jsx";
import TermsBox from "../../components/TermsBox.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { useToast } from "../../components/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { IconSend, IconTicket } from "../../components/NavIcons.jsx";

export default function MyTicket() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [reg, setReg] = useState(undefined);
  const [event, setEvent] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      // RLS only returns the row if it belongs to the signed-in user
      const { data } = await supabase.from("registrations").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();   // my own ticket (admins can read all rows, so ask for mine explicitly)
      setReg(data ?? null);
      if (data) setEvent((await supabase.from("events").select("*").eq("id", data.event_id).maybeSingle()).data);
    })();
  }, [id, user.id]);

  const resend = async () => {
    setSending(true);
    try { await callFunction("send-confirmation-email", { registration_id: id }); toast("Confirmation email sent.", "success"); }
    catch (e) { toast(e.message, "error"); }
    finally { setSending(false); }
  };

  if (reg === undefined) return <Loading />;
  if (!reg) return <p className="text-center text-ink-muted">Ticket not found. <Link className="text-link underline" to="/my-registrations">My registrations</Link></p>;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="flex items-center gap-2 text-2xl"><IconTicket />My ticket</h1>
      <TicketCard registration={reg} event={event} />
      {reg.status === "confirmed" && reg.ticket_number && (
        <div className="card space-y-3 p-4 text-sm">
          <h2 className="text-lg font-bold">Can't attend? Transfer your slot</h2>
          <p className="text-ink">Your confirmation email is your ticket. To transfer your slot, forward that email to the new owner. We are not responsible for unauthorized leaks of your ticket. Keep it confidential.</p>
          <button className="btn-secondary" onClick={resend} disabled={sending}><IconSend />{sending ? "Sending…" : "Email me my confirmation again"}</button>
        </div>
      )}
      <TermsBox event={event} />
      <p className="text-center"><Link className="text-link underline" to="/my-registrations">← My registrations</Link></p>
    </div>
  );
}
