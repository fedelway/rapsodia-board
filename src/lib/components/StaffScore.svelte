<script lang="ts">
  import { onMount } from 'svelte'
  import { game } from '../game/state.svelte'
  import { renderStaff } from '../music/notation'

  let open = $state(true)
  let host = $state<HTMLDivElement | undefined>(undefined)
  let hostWidth = $state(800)
  let error = $state<string | null>(null)

  onMount(() => {
    const node = host
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) hostWidth = width
    })
    observer.observe(node)
    hostWidth = node.clientWidth || 800
    return () => observer.disconnect()
  })

  $effect(() => {
    if (!open || !host) return
    const assembled = game.assembledHarmonyForScore()
    const pendingMelody = game.selectedMelodyNote ?? null
    const chords = [...game.closedChords]
    const melody = [...game.melody]
    const width = hostWidth
    const node = host
    let cancelled = false
    queueMicrotask(() => {
      if (!node || !open || cancelled) return
      void renderStaff(
        node,
        { chords, assembledHarmony: assembled, melody, pendingMelody, width },
        () => cancelled,
      )
        .then(() => {
          if (!cancelled) error = null
        })
        .catch((err: unknown) => {
          if (cancelled) return
          error = err instanceof Error ? err.message : 'No se pudo dibujar la partitura'
        })
    })
    return () => {
      cancelled = true
    }
  })
</script>

<details class="fold" bind:open>
  <summary>
    <span>Partitura</span>
    <em>{open ? 'ocultar' : 'mostrar'}</em>
  </summary>
  <p class="legend">
    Melodía en el pentagrama · barras de compás 4/4 · cifrado al completar la tríada · al cerrar el acorde, las notas van entre paréntesis · naranja = melodía de prueba
  </p>
  {#if error}
    <p class="fail">{error}</p>
  {/if}
  <div class="paper">
    <div class="staff" bind:this={host}></div>
  </div>
</details>

<style>
  .fold {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 0 16px 16px;
    text-align: left;
  }

  summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 14px 0 10px;
    color: var(--text-h);
    font-weight: 650;
    font-size: 1.05rem;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary em {
    font-style: normal;
    font-weight: 500;
    font-size: 0.82rem;
    opacity: 0.65;
  }

  .legend {
    margin: 0 0 10px;
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .paper {
    overflow-x: auto;
    border-radius: 12px;
    background: #f4eee3;
  }

  .staff {
    min-height: 130px;
    min-width: 560px;
  }

  .fail {
    color: #e8a0a0;
    font-size: 0.9rem;
  }
</style>
