"use client";

import * as React from "react";
import { setNonce } from "get-nonce";

interface RuntimeStyleNonceProps {
  nonce: string;
}

export function RuntimeStyleNonce({ nonce }: RuntimeStyleNonceProps) {
  React.useInsertionEffect(() => {
    setNonce(nonce);
    return () => setNonce("");
  }, [nonce]);

  return null;
}
