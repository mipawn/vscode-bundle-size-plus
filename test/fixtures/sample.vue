<!-- Sample Vue file for testing -->
<template>
  <div>
    <h1>{{ title }}</h1>
    <button @click="fetchData">Fetch Data</button>
  </div>
</template>

<script>
import axios from 'axios';
import { ref } from 'vue';
import lodash from 'lodash';

export default {
  setup() {
    const title = ref('Hello Vue');

    const fetchData = async () => {
      const response = await axios.get('/api/data');
      console.log(response.data);
    };

    return {
      title,
      fetchData
    };
  }
};
</script>

<style scoped>
h1 {
  color: blue;
}
</style>
