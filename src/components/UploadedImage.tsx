import { Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import type { ImageSize } from "../types";

type Props = {
  src: string;
  onLoaded: (size: ImageSize) => void;
};

export function UploadedImage({ src, onLoaded }: Props) {
  const [image] = useImage(src);

  if (!image) return null;

  onLoaded({
    width: image.width,
    height: image.height,
  });

  return (
    <KonvaImage
      image={image}
      x={0}
      y={0}
      width={image.width}
      height={image.height}
    />
  );
}