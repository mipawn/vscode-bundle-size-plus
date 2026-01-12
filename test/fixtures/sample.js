// Sample JavaScript file for testing
import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import lodash from 'lodash';
import moment from 'moment';

const MyComponent = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get('/api/data').then(response => {
      setData(response.data);
    });
  }, []);

  return <div>Hello World</div>;
};

export default MyComponent;
