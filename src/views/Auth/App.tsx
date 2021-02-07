import React, { useEffect, useState } from "react";
import { Button, Input, Spacer, useInput } from "@geist-ui/react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../stores/reducers";
import { sendMessage, MessageType } from "../../utils/messenger";
import { setPermissions } from "../../stores/actions";
import { getRealURL } from "../../utils/url";
import { PermissionType, PermissionDescriptions } from "weavemask";
import { CreateTransactionInterface } from "arweave/web/common";
import Transaction from "arweave/node/lib/transaction";
import Cryptr from "cryptr";
import styles from "../../styles/views/Auth/view.module.sass";

export default function App() {
  const passwordInput = useInput(""),
    [passwordStatus, setPasswordStatus] = useState<
      "default" | "secondary" | "success" | "warning" | "error"
    >(),
    wallets = useSelector((state: RootState) => state.wallets),
    [loading, setLoading] = useState(false),
    [loggedIn, setLoggedIn] = useState(false),
    permissions = useSelector((state: RootState) => state.permissions),
    [requestedPermissions, setRequestedPermissions] = useState<
      PermissionType[]
    >([]),
    [currentURL, setCurrentURL] = useState<string>(),
    [type, setType] = useState<AuthType>(),
    dispatch = useDispatch(),
    [alreadyHasPermissions, setAlreadyHasPermissions] = useState(false),
    [attributes, setAttributes] = useState<
      Partial<CreateTransactionInterface>
    >();

  useEffect(() => {
    const authVal = new URL(window.location.href).searchParams.get("auth");

    // invalid auth
    if (!authVal) {
      sendMessage({
        type: getReturnType(),
        ext: "weavemask",
        res: false,
        message: "Invalid auth call",
        sender: "popup"
      });
      window.close();
      return;
    }

    const decodedAuthParam: {
      permissions?: PermissionType[];
      type?: AuthType;
      url?: string;
      attributes?: Partial<CreateTransactionInterface>;
    } = JSON.parse(decodeURIComponent(authVal));

    if (!decodedAuthParam.type) {
      sendMessage({
        type: getReturnType(),
        ext: "weavemask",
        res: false,
        message: "Invalid auth call",
        sender: "popup"
      });
      window.close();
      return;
    } else setType(decodedAuthParam.type);

    const url = decodedAuthParam.url;
    if (
      decodedAuthParam.type === "connect" &&
      decodedAuthParam.permissions &&
      url
    ) {
      const realURL = getRealURL(url),
        existingPermissions = permissions.find(({ url }) => url === realURL);

      setRequestedPermissions(decodedAuthParam.permissions);
      setCurrentURL(realURL);

      if (existingPermissions && existingPermissions.permissions.length > 0) {
        setAlreadyHasPermissions(true);
        setRequestedPermissions(
          decodedAuthParam.permissions.filter(
            (perm) => !existingPermissions.permissions.includes(perm)
          )
        );
      }
    } else if (
      decodedAuthParam.type === "create_transaction" &&
      decodedAuthParam.attributes &&
      url
    ) {
      if (!decodedAuthParam.url) return;
      const perms =
        permissions.find(({ url }) => url === getRealURL(url))?.permissions ??
        [];
      if (!perms.includes("CREATE_TRANSACTION")) return sendPermissionError();

      setAttributes(decodedAuthParam.attributes);
    } else {
      sendMessage({
        type: getReturnType(),
        ext: "weavemask",
        res: false,
        message: "Invalid auth call",
        sender: "popup"
      });
      window.close();
      return;
    }

    window.addEventListener("beforeunload", cancel);

    return function cleanup() {
      window.removeEventListener("beforeunload", cancel);
    };
    // eslint-disable-next-line
  }, []);

  async function login() {
    setLoading(true);
    // we need to wait a bit, because the decrypting
    // freezes the program, and the loading does not start
    setTimeout(() => {
      // try to login by decrypting
      try {
        const cryptr = new Cryptr(passwordInput.state);
        cryptr.decrypt(wallets[0].keyfile);
        setLoggedIn(true);

        if (type !== "connect") {
          if (!currentURL) return urlError();
          else handleNonPermissionAction();
        } else setLoggedIn(true);
      } catch {
        setPasswordStatus("error");
      }
      setLoading(false);
    }, 70);
  }

  function urlError() {
    sendMessage({
      type: getReturnType(),
      ext: "weavemask",
      res: false,
      message: "No tab selected",
      sender: "popup"
    });
    window.close();
  }

  function getReturnType(): MessageType {
    if (type === "connect") return "connect_result";
    else if (type === "create_transaction") return "create_transaction_result";
    else if (type === "sign_transaction") return "sign_transaction_result";
    else if (type === "create_and_sign_transaction")
      return "create_and_sign_transaction_result";
    //
    return "connect_result";
  }

  function accept() {
    if (!loggedIn) return;
    if (!currentURL) return urlError();

    const currentPerms: PermissionType[] =
      permissions.find(({ url }) => url === currentURL)?.permissions ?? [];
    dispatch(
      setPermissions(currentURL, [...currentPerms, ...requestedPermissions])
    );
    sendMessage({
      type: getReturnType(),
      ext: "weavemask",
      res: true,
      message: "Success",
      sender: "popup"
    });
    window.close();
  }

  function cancel() {
    sendMessage({
      type: getReturnType(),
      ext: "weavemask",
      res: false,
      message: "User cancelled the login",
      sender: "popup"
    });
    window.close();
  }

  function getPermissionDescription(permission: PermissionType) {
    return PermissionDescriptions[permission];
  }

  function handleNonPermissionAction() {
    if (type === "create_transaction") {
      // TODO
    }

    //
    sendMessage({
      type: getReturnType(),
      ext: "weavemask",
      res: true,
      message: "Success",
      sender: "popup"
    });
  }

  function sendPermissionError() {
    sendMessage({
      type: getReturnType(),
      ext: "weavemask",
      res: false,
      message:
        "The site does not have the required permissions for this action",
      sender: "popup"
    });
  }

  return (
    <div className={styles.Auth}>
      {(!loggedIn && (
        <>
          <h1>Sign In</h1>
          {(type === "connect" && (
            <p>
              This site wants to connect to WeaveMask. Please enter your
              password to continue.
            </p>
          )) || (
            <p>
              This site wants to{" "}
              {type === "sign_transaction"
                ? "sign a transaction"
                : type === "create_transaction"
                ? "create a transaction"
                : "create and sign a transaction"}
              . Please enter your password to continue.
            </p>
          )}
          <Input
            {...passwordInput.bindings}
            status={passwordStatus}
            placeholder="Password..."
            type="password"
            onKeyPress={(e) => {
              if (e.key === "Enter") login();
            }}
          />
          <Spacer />
          <Button
            style={{ width: "100%" }}
            onClick={login}
            loading={loading}
            type="success"
          >
            Log In
          </Button>
          <Spacer />
          <Button style={{ width: "100%" }} onClick={cancel}>
            Cancel
          </Button>
          <h2 className={styles.th8ta}>
            th<span>8</span>ta
          </h2>
        </>
      )) || (
        <>
          <h1>Permissions</h1>
          {(alreadyHasPermissions && (
            <p>This site wants to access more permissions:</p>
          )) || <p>Please allow these permissions for this site</p>}
          {(requestedPermissions.length > 0 && (
            <ul>
              {requestedPermissions.map((permission, i) => (
                <li key={i}>{getPermissionDescription(permission)}</li>
              ))}
            </ul>
          )) || <p>No permissions requested.</p>}
          <Spacer />
          <Button style={{ width: "100%" }} onClick={accept} type="success">
            Accept
          </Button>
          <Spacer />
          <Button style={{ width: "100%" }} onClick={cancel}>
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}

type AuthType =
  | "connect"
  | "create_transaction"
  | "sign_transaction"
  | "create_and_sign_transaction";
