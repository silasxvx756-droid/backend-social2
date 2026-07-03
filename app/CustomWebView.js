import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function CustomWebView({ url }) {
  if (Platform.OS === 'web') {
    // Renderiza um iframe nativo para navegadores
    return (
      <iframe
        src={url}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Pagamento"
      />
    );
  }

  // Renderiza o WebView nativo para Android/iOS
  return (
    <WebView 
      source={{ uri: url }} 
      style={StyleSheet.absoluteFill} 
    />
  );
}