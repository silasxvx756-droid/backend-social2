declare module "react-native-pdf-thumbnails" {
  export function generateThumbnails(
    uri: string,
    count?: number
  ): Promise<{ uri: string }[]>;
}
