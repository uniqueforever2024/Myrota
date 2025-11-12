import { CreateLeaveRequestData, CreateLeaveRequestVariables, GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables, UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables, ListUsersData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateLeaveRequest(options?: useDataConnectMutationOptions<CreateLeaveRequestData, FirebaseError, CreateLeaveRequestVariables>): UseDataConnectMutationResult<CreateLeaveRequestData, CreateLeaveRequestVariables>;
export function useCreateLeaveRequest(dc: DataConnect, options?: useDataConnectMutationOptions<CreateLeaveRequestData, FirebaseError, CreateLeaveRequestVariables>): UseDataConnectMutationResult<CreateLeaveRequestData, CreateLeaveRequestVariables>;

export function useGetLeaveRequestsForUser(vars: GetLeaveRequestsForUserVariables, options?: useDataConnectQueryOptions<GetLeaveRequestsForUserData>): UseDataConnectQueryResult<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;
export function useGetLeaveRequestsForUser(dc: DataConnect, vars: GetLeaveRequestsForUserVariables, options?: useDataConnectQueryOptions<GetLeaveRequestsForUserData>): UseDataConnectQueryResult<GetLeaveRequestsForUserData, GetLeaveRequestsForUserVariables>;

export function useUpdateLeaveRequestStatus(options?: useDataConnectMutationOptions<UpdateLeaveRequestStatusData, FirebaseError, UpdateLeaveRequestStatusVariables>): UseDataConnectMutationResult<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;
export function useUpdateLeaveRequestStatus(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateLeaveRequestStatusData, FirebaseError, UpdateLeaveRequestStatusVariables>): UseDataConnectMutationResult<UpdateLeaveRequestStatusData, UpdateLeaveRequestStatusVariables>;

export function useListUsers(options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
