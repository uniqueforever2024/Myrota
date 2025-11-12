# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetLeaveRequestsForUser*](#getleaverequestsforuser)
  - [*ListUsers*](#listusers)
- [**Mutations**](#mutations)
  - [*CreateLeaveRequest*](#createleaverequest)
  - [*UpdateLeaveRequestStatus*](#updateleaverequeststatus)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetLeaveRequestsForUser
You can execute the `GetLeaveRequestsForUser` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getLeaveRequestsForUser(vars: GetLeaveRequestsForUserVariables): QueryPromise<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;

interface GetLeaveRequestsForUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetLeaveRequestsForUserVariables): QueryRef<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;
}
export const getLeaveRequestsForUserRef: GetLeaveRequestsForUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getLeaveRequestsForUser(dc: DataConnect, vars: GetLeaveRequestsForUserVariables): QueryPromise<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;

interface GetLeaveRequestsForUserRef {
  ...
  (dc: DataConnect, vars: GetLeaveRequestsForUserVariables): QueryRef<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;
}
export const getLeaveRequestsForUserRef: GetLeaveRequestsForUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getLeaveRequestsForUserRef:
```typescript
const name = getLeaveRequestsForUserRef.operationName;
console.log(name);
```

### Variables
The `GetLeaveRequestsForUser` query requires an argument of type `GetLeaveRequestsForUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetLeaveRequestsForUserVariables {
  userId: UUIDString;
}
```
### Return Type
Recall that executing the `GetLeaveRequestsForUser` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetLeaveRequestsForUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetLeaveRequestsForUserData {
  leaveRequests: ({
    id: UUIDString;
    startDate: DateString;
    endDate: DateString;
    reason?: string | null;
    status: string;
    leaveType: {
      name: string;
    };
  } & LeaveRequest_Key)[];
}
```
### Using `GetLeaveRequestsForUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getLeaveRequestsForUser, GetLeaveRequestsForUserVariables } from '@dataconnect/generated';

// The `GetLeaveRequestsForUser` query requires an argument of type `GetLeaveRequestsForUserVariables`:
const getLeaveRequestsForUserVars: GetLeaveRequestsForUserVariables = {
  userId: ..., 
};

// Call the `getLeaveRequestsForUser()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getLeaveRequestsForUser(getLeaveRequestsForUserVars);
// Variables can be defined inline as well.
const { data } = await getLeaveRequestsForUser({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getLeaveRequestsForUser(dataConnect, getLeaveRequestsForUserVars);

console.log(data.leaveRequests);

// Or, you can use the `Promise` API.
getLeaveRequestsForUser(getLeaveRequestsForUserVars).then((response) => {
  const data = response.data;
  console.log(data.leaveRequests);
});
```

### Using `GetLeaveRequestsForUser`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getLeaveRequestsForUserRef, GetLeaveRequestsForUserVariables } from '@dataconnect/generated';

// The `GetLeaveRequestsForUser` query requires an argument of type `GetLeaveRequestsForUserVariables`:
const getLeaveRequestsForUserVars: GetLeaveRequestsForUserVariables = {
  userId: ..., 
};

// Call the `getLeaveRequestsForUserRef()` function to get a reference to the query.
const ref = getLeaveRequestsForUserRef(getLeaveRequestsForUserVars);
// Variables can be defined inline as well.
const ref = getLeaveRequestsForUserRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getLeaveRequestsForUserRef(dataConnect, getLeaveRequestsForUserVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.leaveRequests);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.leaveRequests);
});
```

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listUsers(): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has no variables.
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListUsersData {
  users: ({
    id: UUIDString;
    displayName: string;
    email: string;
    role: string;
  } & User_Key)[];
}
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers } from '@dataconnect/generated';


// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef } from '@dataconnect/generated';


// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateLeaveRequest
You can execute the `CreateLeaveRequest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createLeaveRequest(vars: CreateLeaveRequestVariables): MutationPromise<CreateLeaveRequestData, CreateLeaveRequestVariables>;

interface CreateLeaveRequestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateLeaveRequestVariables): MutationRef<CreateLeaveRequestData, CreateLeaveRequestVariables>;
}
export const createLeaveRequestRef: CreateLeaveRequestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createLeaveRequest(dc: DataConnect, vars: CreateLeaveRequestVariables): MutationPromise<CreateLeaveRequestData, CreateLeaveRequestVariables>;

interface CreateLeaveRequestRef {
  ...
  (dc: DataConnect, vars: CreateLeaveRequestVariables): MutationRef<CreateLeaveRequestData, CreateLeaveRequestVariables>;
}
export const createLeaveRequestRef: CreateLeaveRequestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createLeaveRequestRef:
```typescript
const name = createLeaveRequestRef.operationName;
console.log(name);
```

### Variables
The `CreateLeaveRequest` mutation requires an argument of type `CreateLeaveRequestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateLeaveRequestVariables {
  requesterId: UUIDString;
  leaveTypeId: UUIDString;
  startDate: DateString;
  endDate: DateString;
  reason: string;
  comments?: string | null;
  status: string;
}
```
### Return Type
Recall that executing the `CreateLeaveRequest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateLeaveRequestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateLeaveRequestData {
  leaveRequest_insert: LeaveRequest_Key;
}
```
### Using `CreateLeaveRequest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createLeaveRequest, CreateLeaveRequestVariables } from '@dataconnect/generated';

// The `CreateLeaveRequest` mutation requires an argument of type `CreateLeaveRequestVariables`:
const createLeaveRequestVars: CreateLeaveRequestVariables = {
  requesterId: ..., 
  leaveTypeId: ..., 
  startDate: ..., 
  endDate: ..., 
  reason: ..., 
  comments: ..., // optional
  status: ..., 
};

// Call the `createLeaveRequest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createLeaveRequest(createLeaveRequestVars);
// Variables can be defined inline as well.
const { data } = await createLeaveRequest({ requesterId: ..., leaveTypeId: ..., startDate: ..., endDate: ..., reason: ..., comments: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createLeaveRequest(dataConnect, createLeaveRequestVars);

console.log(data.leaveRequest_insert);

// Or, you can use the `Promise` API.
createLeaveRequest(createLeaveRequestVars).then((response) => {
  const data = response.data;
  console.log(data.leaveRequest_insert);
});
```

### Using `CreateLeaveRequest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createLeaveRequestRef, CreateLeaveRequestVariables } from '@dataconnect/generated';

// The `CreateLeaveRequest` mutation requires an argument of type `CreateLeaveRequestVariables`:
const createLeaveRequestVars: CreateLeaveRequestVariables = {
  requesterId: ..., 
  leaveTypeId: ..., 
  startDate: ..., 
  endDate: ..., 
  reason: ..., 
  comments: ..., // optional
  status: ..., 
};

// Call the `createLeaveRequestRef()` function to get a reference to the mutation.
const ref = createLeaveRequestRef(createLeaveRequestVars);
// Variables can be defined inline as well.
const ref = createLeaveRequestRef({ requesterId: ..., leaveTypeId: ..., startDate: ..., endDate: ..., reason: ..., comments: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createLeaveRequestRef(dataConnect, createLeaveRequestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.leaveRequest_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.leaveRequest_insert);
});
```

## UpdateLeaveRequestStatus
You can execute the `UpdateLeaveRequestStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateLeaveRequestStatus(vars: UpdateLeaveRequestStatusVariables): MutationPromise<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;

interface UpdateLeaveRequestStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateLeaveRequestStatusVariables): MutationRef<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;
}
export const updateLeaveRequestStatusRef: UpdateLeaveRequestStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateLeaveRequestStatus(dc: DataConnect, vars: UpdateLeaveRequestStatusVariables): MutationPromise<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;

interface UpdateLeaveRequestStatusRef {
  ...
  (dc: DataConnect, vars: UpdateLeaveRequestStatusVariables): MutationRef<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;
}
export const updateLeaveRequestStatusRef: UpdateLeaveRequestStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateLeaveRequestStatusRef:
```typescript
const name = updateLeaveRequestStatusRef.operationName;
console.log(name);
```

### Variables
The `UpdateLeaveRequestStatus` mutation requires an argument of type `UpdateLeaveRequestStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateLeaveRequestStatusVariables {
  id: UUIDString;
  status: string;
  managerComments?: string | null;
}
```
### Return Type
Recall that executing the `UpdateLeaveRequestStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateLeaveRequestStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateLeaveRequestStatusData {
  leaveRequest_update?: LeaveRequest_Key | null;
}
```
### Using `UpdateLeaveRequestStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateLeaveRequestStatus, UpdateLeaveRequestStatusVariables } from '@dataconnect/generated';

// The `UpdateLeaveRequestStatus` mutation requires an argument of type `UpdateLeaveRequestStatusVariables`:
const updateLeaveRequestStatusVars: UpdateLeaveRequestStatusVariables = {
  id: ..., 
  status: ..., 
  managerComments: ..., // optional
};

// Call the `updateLeaveRequestStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateLeaveRequestStatus(updateLeaveRequestStatusVars);
// Variables can be defined inline as well.
const { data } = await updateLeaveRequestStatus({ id: ..., status: ..., managerComments: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateLeaveRequestStatus(dataConnect, updateLeaveRequestStatusVars);

console.log(data.leaveRequest_update);

// Or, you can use the `Promise` API.
updateLeaveRequestStatus(updateLeaveRequestStatusVars).then((response) => {
  const data = response.data;
  console.log(data.leaveRequest_update);
});
```

### Using `UpdateLeaveRequestStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateLeaveRequestStatusRef, UpdateLeaveRequestStatusVariables } from '@dataconnect/generated';

// The `UpdateLeaveRequestStatus` mutation requires an argument of type `UpdateLeaveRequestStatusVariables`:
const updateLeaveRequestStatusVars: UpdateLeaveRequestStatusVariables = {
  id: ..., 
  status: ..., 
  managerComments: ..., // optional
};

// Call the `updateLeaveRequestStatusRef()` function to get a reference to the mutation.
const ref = updateLeaveRequestStatusRef(updateLeaveRequestStatusVars);
// Variables can be defined inline as well.
const ref = updateLeaveRequestStatusRef({ id: ..., status: ..., managerComments: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateLeaveRequestStatusRef(dataConnect, updateLeaveRequestStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.leaveRequest_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.leaveRequest_update);
});
```

