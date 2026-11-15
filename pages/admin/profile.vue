<script setup>
// The Profile tab: who is signed in, the pages that have no tab of their own, and sign out.
const MANAGE = [
  ["/admin/events", "Events", "Create events, kits and images", "IconCalendar"],
  ["/admin/payments", "Payments", "Verify receipts", "IconWallet", "pending"],
  ["/admin/emails", "Email templates and logs", "Edit emails, send bulk mail, see logs", "IconMail"],
  ["/admin/users", "Admin users", "Promote or demote people", "IconShield"],
  ["/admin/changelog", "Change log", "Who changed what", "IconHistory"],
];
const { profile, signOut } = useAuth();
const { pending } = useAdminContext();
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 md:items-start">
    <h1 class="flex items-center gap-2 md:col-span-2"><IconUser />Profile</h1>
    <section aria-labelledby="acct-h" class="card space-y-2 p-4">
      <h2 id="acct-h">Account</h2>
      <dl class="space-y-1 text-sm">
        <div class="flex justify-between gap-2"><dt class="font-semibold">Name</dt><dd>{{ profile?.full_name || "—" }}</dd></div>
        <div class="flex justify-between gap-2"><dt class="font-semibold">Email</dt><dd class="break-all text-right">{{ profile?.email }}</dd></div>
        <div class="flex justify-between gap-2"><dt class="font-semibold">Role</dt><dd><span class="badge badge-info">{{ profile?.role || "admin" }}</span></dd></div>
      </dl>
      <div class="flex flex-col gap-2 pt-2">
        <NuxtLink to="/" class="btn-secondary"><IconArrowLeft />Switch to attendee view</NuxtLink>
        <button type="button" class="btn-danger" @click="signOut"><IconLogOut />Sign out</button>
      </div>
    </section>
    <section aria-labelledby="manage-h" class="card p-2">
      <h2 id="manage-h" class="px-2 pb-1 pt-2">Manage</h2>
      <ul class="divide-y divide-brand-sky">
        <li v-for="[to, label, hint, icon, badge] in MANAGE" :key="to">
          <NuxtLink :to="to" class="flex min-h-[3.5rem] items-center gap-3 rounded-lg px-3 py-2 text-ink no-underline hover:bg-brand-sky">
            <component :is="icon" />
            <span class="min-w-0 flex-1"><span class="block font-semibold">{{ label }}</span><span class="block text-sm text-ink-muted">{{ hint }}</span></span>
            <span v-if="badge === 'pending' && pending > 0" class="rounded-full bg-brand-coral px-2 text-xs font-extrabold text-ink"><span aria-hidden="true">{{ pending > 99 ? "99+" : pending }}</span><span class="sr-only">{{ pending }} payments pending verification</span></span>
            <IconChevronRight />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
