<script>
  import { createEventDispatcher } from "svelte";
  import LaTeXRenderer from "../latex-renderer.js";

  export let value = "";
  let editing = false;
  let renderedHTML = "";

  const dispatch = createEventDispatcher();
  const renderer = new LaTeXRenderer();

  function updateRenderedHTML() {
    renderedHTML = renderer.renderMath(value);
  }

  function handleInput(event) {
    value = event.target.value;
    updateRenderedHTML();
    dispatch("input", value);
  }

  function toggleEdit() {
    editing = !editing;
    if (!editing) {
      updateRenderedHTML();
    }
  }

  $: updateRenderedHTML(value);
</script>

<div class="latex-container">
  {#if editing}
    <textarea
      class="latex-editor"
      {value}
      on:input={handleInput}
      on:blur={toggleEdit}
      rows="4"
      cols="50"
    ></textarea>
  {:else}
    <div class="latex-render" on:click={toggleEdit}>
      {@html renderedHTML}
    </div>
  {/if}
</div>

<style>
  .latex-container {
    position: relative;
    cursor: pointer;
  }
  .latex-editor {
    width: 100%;
    box-sizing: border-box;
  }
  .latex-render {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    min-height: 40px;
  }
</style>
