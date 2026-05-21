import React from 'react';
import ReactDOM from 'react-dom/client';
import { BidKingApp } from './bidking/app/BidKingApp';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BidKingApp />
  </React.StrictMode>
);
