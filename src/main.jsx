import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

console.log('main.jsx loaded - starting React render');
const root = document.getElementById('root');
console.log('root element:', root);

if (!root) {
  console.error('Root element not found!');
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log('React render complete');
}
