import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateLeaveRequestData {
  leaveRequest_insert: LeaveRequest_Key;
}

export interface CreateLeaveRequestVariables {
  requesterId: UUIDString;
  leaveTypeId: UUIDString;
  startDate: DateString;
  endDate: DateString;
  reason: string;
  comments?: string | null;
  status: string;
}

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

export interface GetLeaveRequestsForUserVariables {
  userId: UUIDString;
}

export interface Holiday_Key {
  id: UUIDString;
  __typename?: 'Holiday_Key';
}

export interface LeaveBalance_Key {
  id: UUIDString;
  __typename?: 'LeaveBalance_Key';
}

export interface LeaveRequest_Key {
  id: UUIDString;
  __typename?: 'LeaveRequest_Key';
}

export interface LeaveType_Key {
  id: UUIDString;
  __typename?: 'LeaveType_Key';
}

export interface ListUsersData {
  users: ({
    id: UUIDString;
    displayName: string;
    email: string;
    role: string;
  } & User_Key)[];
}

export interface UpdateLeaveRequestStatusData {
  leaveRequest_update?: LeaveRequest_Key | null;
}

export interface UpdateLeaveRequestStatusVariables {
  id: UUIDString;
  status: string;
  managerComments?: string | null;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateLeaveRequestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateLeaveRequestVariables): MutationRef<CreateLeaveRequestData, CreateLeaveRequestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateLeaveRequestVariables): MutationRef<CreateLeaveRequestData, CreateLeaveRequestVariables>;
  operationName: string;
}
export const createLeaveRequestRef: CreateLeaveRequestRef;

export function createLeaveRequest(vars: CreateLeaveRequestVariables): MutationPromise<CreateLeaveRequestData, CreateLeaveRequestVariables>;
export function createLeaveRequest(dc: DataConnect, vars: CreateLeaveRequestVariables): MutationPromise<CreateLeaveRequestData, CreateLeaveRequestVariables>;

interface GetLeaveRequestsForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetLeaveRequestsForUserVariables): QueryRef<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetLeaveRequestsForUserVariables): QueryRef<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;
  operationName: string;
}
export const getLeaveRequestsForUserRef: GetLeaveRequestsForUserRef;

export function getLeaveRequestsForUser(vars: GetLeaveRequestsForUserVariables): QueryPromise<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;
export function getLeaveRequestsForUser(dc: DataConnect, vars: GetLeaveRequestsForUserVariables): QueryPromise<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;

interface UpdateLeaveRequestStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateLeaveRequestStatusVariables): MutationRef<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateLeaveRequestStatusVariables): MutationRef<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;
  operationName: string;
}
export const updateLeaveRequestStatusRef: UpdateLeaveRequestStatusRef;

export function updateLeaveRequestStatus(vars: UpdateLeaveRequestStatusVariables): MutationPromise<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;
export function updateLeaveRequestStatus(dc: DataConnect, vars: UpdateLeaveRequestStatusVariables): MutationPromise<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect): QueryPromise<ListUsersData, undefined>;

