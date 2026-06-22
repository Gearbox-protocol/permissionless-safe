"use client";

import { chains } from "@/config/wagmi";
import {
  getCustomRpcUrls,
  isValidRpcUrl,
  removeCustomRpcUrl,
  setCustomRpcUrl,
} from "@/config/custom-rpc";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@gearbox-protocol/permissionless-ui";
import { Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const chainNameById = new Map<number, string>(
  chains.map((chain) => [chain.id, chain.name])
);

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [chainId, setChainId] = useState<string>(String(chains[0].id));
  const [url, setUrl] = useState("");
  const [customRpcs, setCustomRpcs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (open) {
      setCustomRpcs(getCustomRpcUrls());
    }
  }, [open]);

  const handleSave = () => {
    const trimmed = url.trim();
    if (!isValidRpcUrl(trimmed)) {
      toast.error("Enter a valid http(s) RPC URL");
      return;
    }

    setCustomRpcUrl(Number(chainId), trimmed);
    toast.success("Custom RPC saved. Reloading…");
    setUrl("");
    setTimeout(() => window.location.reload(), 600);
  };

  const handleRemove = (id: number) => {
    removeCustomRpcUrl(id);
    setCustomRpcs(getCustomRpcUrls());
    toast.success("Custom RPC removed. Reloading…");
    setTimeout(() => window.location.reload(), 600);
  };

  const existing = Object.entries(customRpcs);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium text-foreground">Use custom RPC</h4>
            <p className="text-sm text-muted-foreground">
              Override the default RPC endpoint for a network
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-chain">Network</Label>
            <Select value={chainId} onValueChange={setChainId}>
              <SelectTrigger id="settings-chain">
                <SelectValue placeholder="Select network" />
              </SelectTrigger>
              <SelectContent>
                {chains.map((chain) => (
                  <SelectItem key={chain.id} value={String(chain.id)}>
                    {chain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-rpc">RPC URL</Label>
            <Input
              id="settings-rpc"
              placeholder="https://my-node.example.com/rpc"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>

          <Button className="w-full" onClick={handleSave}>
            Save custom RPC
          </Button>

          {existing.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Active overrides</p>
              <div className="space-y-2">
                {existing.map(([id, value]) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground">
                        {chainNameById.get(Number(id)) ?? `Chain ${id}`}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {value}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove custom RPC"
                      onClick={() => handleRemove(Number(id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
