<script lang="ts">
  import type { MelodyDurationKey } from '../music/harmony'

  let {
    kind,
    size = 28,
    asRest = false,
  }: { kind: MelodyDurationKey; size?: number; asRest?: boolean } = $props()

  const open = $derived(kind === 'half' || kind === 'dottedHalf' || kind === 'whole')
  const stem = $derived(kind !== 'whole')
  const flag = $derived(kind === 'eighth')
  const dot = $derived(kind === 'dottedQuarter' || kind === 'dottedHalf')
</script>

<svg
  class="glyph"
  width={size}
  height={size * 1.35}
  viewBox="0 0 32 44"
  aria-hidden="true"
>
  {#if asRest}
    {#if kind === 'eighth'}
      <path d="M18 10 v22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <ellipse cx="22" cy="14" rx="5" ry="3.5" transform="rotate(25 22 14)" fill="currentColor" />
    {:else}
      <path
        d="M16 8 c6 4 2 8 -2 12 c6 2 6 8 0 12"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
      />
      <path d="M14 32 l4 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    {/if}
    {#if dot}
      <circle cx="26" cy="28" r="2.1" fill="currentColor" />
    {/if}
  {:else}
    {#if open}
      <ellipse cx="11" cy="32" rx="7.2" ry="5" transform="rotate(-20 11 32)" fill="none" stroke="currentColor" stroke-width="2.2" />
    {:else}
      <ellipse cx="11" cy="32" rx="7.2" ry="5" transform="rotate(-20 11 32)" fill="currentColor" />
    {/if}
    {#if stem}
      <path d="M18.2 31.2 V8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" />
    {/if}
    {#if flag}
      <path
        d="M18.2 8 C26 10 28 16 26 22 C22 16 18.2 14 18.2 14"
        fill="currentColor"
      />
    {/if}
    {#if dot}
      <circle cx="26" cy="32" r="2.1" fill="currentColor" />
    {/if}
  {/if}
</svg>

<style>
  .glyph {
    display: block;
  }
</style>
