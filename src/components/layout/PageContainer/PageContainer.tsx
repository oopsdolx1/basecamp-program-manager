import { Container } from "@mui/material";
import type { PropsWithChildren } from "react";

export const PageContainer = ({ children }: PropsWithChildren): JSX.Element => (
  <Container maxWidth={false} sx={{ boxSizing: "border-box", display: "flex", flex: 1, flexDirection: "column", marginInline: "auto", maxWidth: 1520, minHeight: 0, px: { lg: 5, md: 3, xs: 2 }, py: { md: 4, xs: 2 }, width: "100%" }}>
    {children}
  </Container>
);
