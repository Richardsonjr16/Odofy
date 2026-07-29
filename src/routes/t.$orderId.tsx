import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t/$orderId")({
  loader: ({ params }) => {
    throw redirect({
      to: "/track/$orderId",
      params: { orderId: params.orderId },
    });
  },
});
