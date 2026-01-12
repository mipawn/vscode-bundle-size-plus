<!-- Sample Svelte file for testing -->
<script>
  import axios from 'axios';
  import { onMount } from 'svelte';
  import lodash from 'lodash';

  let data = null;
  let loading = false;

  async function fetchData() {
    loading = true;
    try {
      const response = await axios.get('/api/data');
      data = response.data;
    } catch (error) {
      console.error(error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchData();
  });
</script>

<main>
  <h1>Hello Svelte</h1>
  {#if loading}
    <p>Loading...</p>
  {:else if data}
    <pre>{JSON.stringify(data, null, 2)}</pre>
  {:else}
    <p>No data</p>
  {/if}
</main>

<style>
  h1 {
    color: purple;
  }
</style>
