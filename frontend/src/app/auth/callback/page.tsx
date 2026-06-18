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
      localStorage.setItem("zklogin_jwt", idToken);
      localStorage.setItem("zklogin_salt", userSalt);

      setStatus("Login successful! Redirecting...");
      setTimeout(() => { window.location.href = "/app"; }, 300);
    } catch (error) {
      console.error("zkLogin callback error:", error);
      setStatus("Login failed. Redirecting...");
      setTimeout(() => router.push("/"), 2000);
    }
  };

  return (
    <>
      <style>{`nav { display: none !important; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0F1E", color: "#dce4e4" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "2px solid #333", borderTopColor: "#63f7ff", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: 14 }}>{status}</p>
        </div>
      </div>
    </>
  );
}
