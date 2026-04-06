// babel.config.js
export default function (api) {
  api.cache(true);
  return {
    presets: [
      // Preset padrão do Expo, com suporte ao NativeWind JSX import
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      
      // Plugin do NativeWind para Tailwind no React Native
      "nativewind/babel",
    ],
  };
}