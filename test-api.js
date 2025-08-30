// Test script to verify Grasshopper API connection

const GH_BASE_URL = 'http://127.0.0.1:9998';

async function testConnection() {
  console.log('Testing connection to Grasshopper server at:', GH_BASE_URL);
  
  try {
    const response = await fetch(GH_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        type: 'get_selected_script_component'
      })
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(result, null, 2));
    
    if (result.status === 'success') {
      console.log('✅ Connection successful! Component data received.');
    } else if (result.status === 'none_selected') {
      console.log('⚠️ Connection works, but no component is selected in Grasshopper.');
    } else if (result.status === 'multiple_selected') {
      console.log('⚠️ Connection works, but multiple components are selected.');
    } else {
      console.log('❌ Unexpected response:', result);
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('Make sure the Grasshopper server is running on port 9998');
  }
}

testConnection();