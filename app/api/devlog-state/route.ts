import { getAccessIdentity } from "../../access-auth";
import { loadDevLog } from "../../dev-log-data";
import { authorizeDevLogIdentity, getDevLogState, patchDevLogState, type DevLogStateNamespace } from "../../dev-log-state";
import { getDevLogStateNamespace } from "../../worker-bindings";

export const runtime = "edge";

function sourceItems() { return loadDevLog().data?.items ?? []; }
function namespace(): DevLogStateNamespace | undefined { return getDevLogStateNamespace(); }

export async function GET(request: Request) {
  const authorization = authorizeDevLogIdentity(await getAccessIdentity(request.headers));
  if (authorization instanceof Response) return authorization;
  return getDevLogState(namespace(), sourceItems());
}

export async function PATCH(request: Request) {
  const authorization = authorizeDevLogIdentity(await getAccessIdentity(request.headers));
  if (authorization instanceof Response) return authorization;
  return patchDevLogState(request, authorization, namespace(), sourceItems());
}
