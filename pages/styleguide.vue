<script setup lang="ts">
// Review page for the redesign components. Not linked anywhere and kept out of search results.
definePageMeta({ layout: "blank" });
useHead({ title: "Style guide", meta: [{ name: "robots", content: "noindex" }] });
const links = [{ label: "Events", to: "/" }, { label: "Shop", to: "/shop" }, { label: "Cart", to: "/cart", badge: 2 }];
const lines = [{ key: "a", title: "ÖRBITAL", subtitle: "Marv · Version A", qty: 2, price: "₱1,500.00" }, { key: "b", title: "Cupsleeve set", qty: 1, price: "₱250.00" }];
</script>

<template>
  <main id="main-content" class="min-h-screen space-y-10 bg-brand-blush p-4 sm:p-8">
    <header class="space-y-4"><PillNav :links="links" /><h1 class="text-3xl">Style guide</h1></header>
    <section class="space-y-3" aria-labelledby="sg-btn"><h2 id="sg-btn" class="text-xl">Buttons</h2>
      <div class="flex flex-wrap gap-3"><BaseButton>Primary</BaseButton><BaseButton variant="secondary">Secondary</BaseButton><BaseButton variant="accent">Accent</BaseButton><BaseButton variant="danger">Danger</BaseButton><BaseButton variant="ghost">Ghost</BaseButton><BaseButton disabled>Disabled</BaseButton><BaseButton small>Small</BaseButton></div></section>
    <section class="space-y-3" aria-labelledby="sg-chip"><h2 id="sg-chip" class="text-xl">Status chips</h2>
      <div class="flex flex-wrap gap-2"><StatusChip tone="ok">Confirmed</StatusChip><StatusChip tone="warn">Pending</StatusChip><StatusChip tone="bad">Rejected</StatusChip><StatusChip tone="info">Info</StatusChip><StatusChip tone="neutral">Neutral</StatusChip><StatusChip tone="new">New</StatusChip><StatusChip tone="popular">Popular</StatusChip><StatusChip tone="low">Low stock</StatusChip></div></section>
    <section class="space-y-3" aria-labelledby="sg-ticket"><h2 id="sg-ticket" class="text-xl">Ticket cards</h2>
      <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="(t, i) in ['IVEMON: ODD PLATINUM Cupsleeve Event', 'Teenfresh Fan Meet', 'Sold-out show']" :key="t"><TicketCard :title="t" subtitle="Hosted by Teenfresh" :band="i" :status-label="i === 2 ? 'Sold out' : 'Available'" :status-tone="i === 2 ? 'bad' : 'ok'" :barcode="i === 0 ? 'IVEMON-000123' : undefined">
          <p>Sat, Dec 12 · 2:00 PM</p><p>Psicom Blue Club, Quezon City</p><p class="font-bold text-ink">₱100.00</p>
          <template #action><BaseButton block variant="accent" to="/">Register</BaseButton></template></TicketCard></li>
      </ul></section>
    <section class="space-y-3" aria-labelledby="sg-prod"><h2 id="sg-prod" class="text-xl">Product cards</h2>
      <ul class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <li><ProductCard title="ÖRBITAL" artist="Marv" to="/shop" price-label="₱750.00" badge="New" :tint="0" /></li>
        <li><ProductCard title="Light stick" artist="IVE" to="/shop" price-label="₱1,200.00" badge="Popular" badge-tone="popular" :tint="1" /></li>
        <li><ProductCard title="Photocard set" artist="Teenfresh" to="/shop" price-label="₱180.00" badge="Low stock" badge-tone="low" :discount="10" :tint="2" /></li>
        <li><ProductCard title="Poster" to="/shop" price-label="₱90.00" :tint="3" /></li></ul></section>
    <section class="space-y-3" aria-labelledby="sg-cart"><h2 id="sg-cart" class="text-xl">Cart stub</h2>
      <CartStub :lines="lines"><p class="text-lg font-black">Total ₱1,750.00</p><BaseButton block variant="accent" class="mt-3" to="/checkout">Checkout</BaseButton></CartStub></section>
  </main>
</template>
