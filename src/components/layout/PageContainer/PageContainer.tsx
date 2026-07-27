import { Container } from "@mui/material";
import type { PropsWithChildren } from "react";

export const PageContainer = ({ children }: PropsWithChildren): JSX.Element => (
  <Container maxWidth="lg" sx={{ py: 4 }}>
    {children}
  </Container>
);
