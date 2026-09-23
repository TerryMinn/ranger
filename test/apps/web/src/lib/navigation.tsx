      import Link from "next/link";
import { useRouter } from "next/navigation";
      import type { ReactNode } from "react";

      export function AppLink({
        to,
        className,
        children,
      }: {
        to: string;
        className?: string;
        children: ReactNode;
      }) {
        return (
          <Link href={to} className={className}>
            {children}
          </Link>
        );
      }

      export function useAppNavigation() {
        const router = useRouter();

        return {
          navigate(to: string) {
            router.push(to);
          },
          refresh() {
            router.refresh();
          },
          getSearchParam(name: string) {
            return new URLSearchParams(window.location.search).get(name);
          },
        };
      }
