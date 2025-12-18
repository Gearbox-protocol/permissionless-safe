import { addressSchema } from "@/utils/validation";
import { iLossPolicyV310Abi } from "@gearbox-protocol/sdk/abi/310/generated";
import {
  AccessMode,
  createCallData,
} from "@gearbox-protocol/sdk/permissionless";
import { Address } from "viem";
import { z } from "zod";
import { BaseEmergencyAction, EmergencyActionData } from "../types";

export interface SetAccessModeParams {
  pool: Address;
  mode: AccessMode;
}

export type SetAccessModeAction = BaseEmergencyAction<
  "LOSS_POLICY::setAccessMode",
  SetAccessModeParams
>;

export const setAccessModeActionData: EmergencyActionData<SetAccessModeAction> =
  {
    type: "LOSS_POLICY::setAccessMode",
    description: "Set loss policy access mode for liquidations",
    schema: z.object({
      pool: addressSchema,
      mode: z.nativeEnum(AccessMode),
    }),

    getRawTx: async ({ mc, action }) => {
      const { params } = action;

      const tx = mc.emergencyConfigureLossPolicy(
        params.pool,
        createCallData(iLossPolicyV310Abi, {
          functionName: "setAccessMode",
          args: [params.mode],
        })
      );

      return { tx, action };
    },
  };
