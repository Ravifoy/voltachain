import Link from "next/link";
import { Zap } from "lucide-react";
import { CONTRACT_ADDRESS } from "@/lib/chain";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-mute md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-2"><Zap className="h-4 w-4 fill-bolt text-bolt" /> VoltaChain · hackathon demo on a local blockchain</p>
        <p className="min-w-0">
          Contract:{" "}
          <Link href={`/explorer?address=${CONTRACT_ADDRESS}`} className="break-all font-mono text-xs text-volt hover:underline">{CONTRACT_ADDRESS}</Link>
        </p>
      </div>
    </footer>
  );
}
