"use client";

import HeaderLayout from "@/components/header";
import {
  GearboxFooter,
  Layout,
  ThemeProvider,
} from "@gearbox-protocol/permissionless-ui";
import { Providers } from "./providers";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <Providers>
        <Layout
          header={<HeaderLayout />}
          footer={
            <GearboxFooter
              appName="Safe"
              legalReferences={{
                termsOfService: "/legal/terms-of-service",
                privacyNotice: "/legal/privacy-notice",
                riskDisclosure: "/legal/risk-disclosure",
              }}
            />
          }
        >
          {children}
        </Layout>
      </Providers>
    </ThemeProvider>
  );
}

