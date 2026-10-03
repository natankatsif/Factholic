"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HomeHero } from "../components/home/HomeHero";
import { createJob } from "../lib/jobs";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Каждая проверка — отдельная страница /check/<jobId>: её можно обновить, переслать, открыть из истории
  const handleCheck = async (input: string, isUrl: boolean) => {
    setIsLoading(true);
    try {
      const jobId = await createJob(input, isUrl);
      router.push(`/check/${jobId}`);
    } catch (err) {
      setIsLoading(false);
      // TODO(frontend): показать ошибку рядом с полем ввода
      console.error(err);
    }
  };

  return <HomeHero onCheck={handleCheck} isLoading={isLoading} />;
}
