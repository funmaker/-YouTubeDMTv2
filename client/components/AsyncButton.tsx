import React from "react";
import { classJoin } from "../helpers/utils";
import useAsyncCallback from "../hooks/useAsyncCallback";

interface AsyncButtonProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  onClick: (ev: React.MouseEvent) => Promise<any>;
}

export default function AsyncButton({ className, onClick: onClickProp, ...props }: AsyncButtonProps) {
  const [onClick, loading] = useAsyncCallback(async (ev: React.MouseEvent) => {
    await onClickProp(ev);
  }, [onClickProp]);
  
  return <button className={classJoin(className, loading && "loading")} {...props} onClick={loading ? doNothing : onClick} />;
}

const doNothing = (ev: React.SyntheticEvent) => ev.preventDefault();

