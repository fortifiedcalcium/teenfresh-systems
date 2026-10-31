import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { isConfigured } from "./lib/supabaseClient.js";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import AdminRoute from "./routes/AdminRoute.jsx";
import AttendeeLayout from "./layouts/AttendeeLayout.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import { FullPageSpinner } from "./components/Spinner.jsx";
import { RouteA11y } from "./a11y.jsx";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import Callback from "./pages/auth/Callback.jsx";
import Home from "./pages/attendee/Home.jsx";
import EventRegister from "./pages/attendee/EventRegister.jsx";
import MyRegistrations from "./pages/attendee/MyRegistrations.jsx";
import MyTicket from "./pages/attendee/MyTicket.jsx";
const Dashboard = lazy(() => import("./pages/admin/Dashboard.jsx"));
const Events = lazy(() => import("./pages/admin/Events.jsx"));
const Attendees = lazy(() => import("./pages/admin/Attendees.jsx"));
const Payments = lazy(() => import("./pages/admin/Payments.jsx"));
const Scanner = lazy(() => import("./pages/admin/Scanner.jsx"));
const Tracker = lazy(() => import("./pages/admin/Tracker.jsx"));
const EmailTemplates = lazy(() => import("./pages/admin/EmailTemplates.jsx"));
const Users = lazy(() => import("./pages/admin/Users.jsx"));

function SetupNotice() {
  return (
    <main id="main-content" className="mx-auto max-w-xl p-8">
      <h1 className="mb-2 text-xl font-bold">Supabase is not configured</h1>
      <p className="text-ink-muted">Copy <code>.env.example</code> to <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.</p>
    </main>
  );
}

export default function App() {
  if (!isConfigured) return <SetupNotice />;
  return (
    <Suspense fallback={<FullPageSpinner />}>
    <RouteA11y />
    <Routes>
      <Route element={<AttendeeLayout />}>
        <Route index element={<Home />} />
        <Route path="events/:id/register" element={<ProtectedRoute><EventRegister /></ProtectedRoute>} />
        <Route path="my-registrations" element={<ProtectedRoute><MyRegistrations /></ProtectedRoute>} />
        <Route path="my-ticket/:id" element={<ProtectedRoute><MyTicket /></ProtectedRoute>} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<Callback />} />

      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="events" element={<Events />} />
        <Route path="payments" element={<Payments />} />
        <Route path="attendees" element={<Attendees />} />
        <Route path="scanner" element={<Scanner />} />
        <Route path="tracker" element={<Tracker />} />
        <Route path="emails" element={<EmailTemplates />} />
        <Route path="users" element={<Users />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
