"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredZkLoginState, getZkLoginAddress, generateUserSalt } from "@/lib/zklogin";
import { isEnokiConfigured, getZkLoginInfoFromEnoki } from "@/lib/enoki";
import { secureSet } from "@/lib/secure-storage";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState("Processing login...");

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get("id_token");

      if (!idToken) throw new Error("No ID token found");

      const zkLoginState = await getStoredZkLoginState();
      if (!zkLoginState) throw new Error("zkLogin state not found");

      let suiAddress: string;
      let userSalt: string;

      if (isEnokiConfigured()) {
        const info = await getZkLoginInfoFromEnoki(idToken);
        suiAddress = info.address;
        userSalt = info.salt;
      } else {
        const payload = JSON.parse(atob(idToken.split(".")[1]));
        userSalt = await generateUserSalt(String(payload.sub));
        suiAddress = await getZkLoginAddress(idToken, userSalt);
      }

      await secureSet("zklogin_jwt", idToken);
      await secureSet("zklogin_salt", userSalt);
      localStorage.setItem("zklogin_address", suiAddress);

      setStatus("Login successful! Redirecting...");
      setTimeout(() => router.push("/"), 500);
    } catch (error) {
      console.error("zkLogin callback error:", error);
      setStatus("Login failed. Redirecting...");
      setTimeout(() => router.push("/"), 2000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
