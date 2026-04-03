import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  withOrbs?: boolean;
}

/** Wraps page content with fade-in animation and optional gradient orbs */
const PageWrapper = ({ children, withOrbs = false }: PageWrapperProps) => (
  <div className={`page-enter${withOrbs ? " gradient-orbs" : ""}`}>
    {children}
  </div>
);

export default PageWrapper;
