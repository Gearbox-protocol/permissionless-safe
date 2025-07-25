"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ViewMain() {
  const [cid, setCid] = useState("");
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(20,20,20)]">
      <Card className="w-full max-w-md bg-[rgb(30,30,30)] border-[rgb(60,60,60)] -mt-20">
        <CardHeader>
          <h1 className="text-center text-2xl font-bold text-white">
            Enter IPFS CID with transactions
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Enter your ipfs cid..."
            value={cid}
            onChange={(e) => {
              setCid(e.target.value);
            }}
          />
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => {
              router.push(`/txs?cid=${cid}`);
            }}
            disabled={!cid}
          >
            Open transactions
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
