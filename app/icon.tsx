import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0F6E56 0%, #1A8A6E 100%)",
          color: "#FFFFFF",
          fontSize: 220,
          fontWeight: 700,
        }}
      >
        W
      </div>
    ),
    {
      ...size,
    },
  );
}
