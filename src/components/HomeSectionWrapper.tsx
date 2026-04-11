import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  index: number;
  className?: string;
}

/** Adds alternating subtle backgrounds and top borders between homepage sections */
const HomeSectionWrapper = ({ children, index, className = "" }: Props) => {
  const bg = index % 2 === 0 ? "" : "bg-muted/5";
  return (
    <div className={`border-t border-border/15 ${bg} ${className}`}>
      {children}
    </div>
  );
};

export default HomeSectionWrapper;
