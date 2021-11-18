export interface Wallet {
  name: string;
  address: string;
  /** The type of wallet this is. */
  type: "local" | "ledger";
  /**
   * The keyfile of the wallet stored in encrypted form.
   * `undefined` if imported from a Ledger.
   */
  keyfile?: string;
}

export interface IWalletsAction {
  type:
    | "ADD_WALLET"
    | "REMOVE_WALLET"
    | "USER_SIGNOUT"
    | "RENAME_WALLET"
    | "SET_WALLETS";
  payload: {
    name?: string;
    wallet?: Wallet;
    address?: string;
    wallets?: Wallet[];
  };
}

export default function walletsReducer(
  state: Wallet[] = [],
  action: IWalletsAction
): Wallet[] {
  switch (action.type) {
    case "ADD_WALLET":
      if (!action.payload.wallet) break;
      if (
        state.find(({ address }) => address === action.payload.wallet?.address)
      )
        break;

      const wallet = action.payload.wallet;

      if (wallet.type === "local") {
        return [...state, action.payload.wallet];
      } else if (wallet.type === "ledger") {
        // Replace existing Ledger wallet.
        return [
          ...state.filter((wallet) => wallet.type === "local"),
          action.payload.wallet
        ];
      } else {
        throw Error("Unknown wallet type");
      }
    case "REMOVE_WALLET":
      if (!action.payload.address) break;
      return state.filter(({ address }) => address !== action.payload.address);

    case "RENAME_WALLET":
      if (
        !action.payload.address ||
        action.payload.name === undefined ||
        action.payload.wallet?.type === "ledger"
      )
        break;
      return state.map((wallet) =>
        wallet.address === action.payload.address
          ? { ...wallet, name: action.payload.name ?? "" }
          : wallet
      );

    case "SET_WALLETS":
      if (!action.payload.wallets) break;
      // remapping to make sure there's no duplication
      const newList: Wallet[] = [];

      for (const wallet of action.payload.wallets)
        if (!newList.find(({ address }) => address === wallet.address))
          newList.push(wallet);

      return newList;

    case "USER_SIGNOUT":
      return [];
  }

  return state;
}
