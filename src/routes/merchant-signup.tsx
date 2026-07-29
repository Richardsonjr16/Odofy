import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

function MerchantSignupRedirect() {
  useEffect(() => {
    window.location.replace("https://82eeac66dfefbde793fabbb1b59d76e4.ctonew.app/register");
  }, []);
  return null;
}

export const Route = createFileRoute("/merchant-signup")({
  component: MerchantSignupRedirect,
});
