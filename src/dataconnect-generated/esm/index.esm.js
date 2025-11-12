import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'myrota',
  location: 'us-east4'
};

export const createLeaveRequestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateLeaveRequest', inputVars);
}
createLeaveRequestRef.operationName = 'CreateLeaveRequest';

export function createLeaveRequest(dcOrVars, vars) {
  return executeMutation(createLeaveRequestRef(dcOrVars, vars));
}

export const getLeaveRequestsForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetLeaveRequestsForUser', inputVars);
}
getLeaveRequestsForUserRef.operationName = 'GetLeaveRequestsForUser';

export function getLeaveRequestsForUser(dcOrVars, vars) {
  return executeQuery(getLeaveRequestsForUserRef(dcOrVars, vars));
}

export const updateLeaveRequestStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateLeaveRequestStatus', inputVars);
}
updateLeaveRequestStatusRef.operationName = 'UpdateLeaveRequestStatus';

export function updateLeaveRequestStatus(dcOrVars, vars) {
  return executeMutation(updateLeaveRequestStatusRef(dcOrVars, vars));
}

export const listUsersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUsers');
}
listUsersRef.operationName = 'ListUsers';

export function listUsers(dc) {
  return executeQuery(listUsersRef(dc));
}

