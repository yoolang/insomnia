import { createSelector } from 'reselect';
import type { ValueOf } from 'type-fest';

import { isWorkspaceActivity, PREVIEW_MODE_SOURCE } from '../../common/constants';
import * as models from '../../models';
import { BaseModel } from '../../models';
import { GrpcRequest, isGrpcRequest } from '../../models/grpc-request';
import { getStatusCandidates } from '../../models/helpers/get-status-candidates';
import { sortProjects } from '../../models/helpers/project';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';
import { isRequest, Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import { type Response } from '../../models/response';
import { UnitTestResult } from '../../models/unit-test-result';
import { isWebSocketRequest, WebSocketRequest } from '../../models/websocket-request';
import { type WebSocketResponse } from '../../models/websocket-response';
import { isCollection } from '../../models/workspace';
import { RootState } from './modules';

type EntitiesLists = {
  [K in keyof RootState['entities']]: ValueOf<RootState['entities'][K]>[];
};

// ~~~~~~~~~ //
// Selectors //
// ~~~~~~~~~ //
export const selectEntities = createSelector(
  (state: RootState) => state.entities,
  entities => entities,
);

export const selectGlobal = createSelector(
  (state: RootState) => state.global,
  global => global,
);

export const selectEntitiesLists = createSelector(
  selectEntities,
  entities => {
    const entitiesLists: any = {};

    for (const k of Object.keys(entities)) {
      const entityMap = (entities as any)[k];
      entitiesLists[k] = Object.keys(entityMap).map(id => entityMap[id]);
    }

    return entitiesLists as EntitiesLists;
  },
);

export const selectEntitiesChildrenMap = createSelector(selectEntitiesLists, entities => {
  const parentLookupMap: any = {};

  for (const key of Object.keys(entities)) {
    for (const entity of (entities as any)[key]) {
      if (!entity.parentId) {
        continue;
      }

      if (parentLookupMap[entity.parentId]) {
        parentLookupMap[entity.parentId].push(entity);
      } else {
        parentLookupMap[entity.parentId] = [entity];
      }
    }
  }

  return parentLookupMap;
});

export const selectStats = createSelector(
  selectEntitiesLists,
  entities => entities.stats[0] || models.stats.init());

export const selectSettings = createSelector(
  selectEntitiesLists,
  entities => entities.settings[0] || models.settings.init());

export const selectRequestMetas = createSelector(
  selectEntitiesLists,
  entities => entities.requestMetas,
);

export const selectGrpcRequestMetas = createSelector(
  selectEntitiesLists,
  entities => entities.grpcRequestMetas,
);

export const selectProjects = createSelector(
  selectEntitiesLists,
  entities => sortProjects(entities.projects),
);

export const selectRemoteProjects = createSelector(
  selectProjects,
  projects => projects.filter(isRemoteProject),
);

export const selectActiveProject = createSelector(
  selectEntities,
  (state: RootState) => state.global.activeProjectId,
  (entities, activeProjectId) => {
    return entities.projects[activeProjectId] || entities.projects[DEFAULT_PROJECT_ID];
  },
);

export const selectDashboardSortOrder = createSelector(
  selectGlobal,
  global => global.dashboardSortOrder
);

export const selectWorkspaces = createSelector(
  selectEntitiesLists,
  entities => entities.workspaces,
);

export const selectWorkspacesForActiveProject = createSelector(
  selectWorkspaces,
  selectActiveProject,
  (workspaces, activeProject) => workspaces.filter(workspace => workspace.parentId === activeProject._id),
);

export const selectActiveWorkspace = createSelector(
  selectWorkspacesForActiveProject,
  (state: RootState) => state.global.activeWorkspaceId,
  (state: RootState) => state.global.activeActivity,
  (workspaces, activeWorkspaceId, activeActivity) => {
    // Only return an active workspace if we're in an activity
    if (activeActivity && isWorkspaceActivity(activeActivity)) {
      const workspace = workspaces.find(workspace => workspace._id === activeWorkspaceId);
      return workspace;
    }

    return undefined;
  },
);

export const selectWorkspaceMetas = createSelector(
  selectEntitiesLists,
  entities => entities.workspaceMetas,
);

export const selectActiveWorkspaceMeta = createSelector(
  selectActiveWorkspace,
  selectEntitiesLists,
  (activeWorkspace, entities) => {
    const id = activeWorkspace ? activeWorkspace._id : 'n/a';
    return entities.workspaceMetas.find(workspaceMeta => workspaceMeta.parentId === id);
  },
);

export const selectApiSpecs = createSelector(
  selectEntitiesLists,
  entities => entities.apiSpecs,
);

export const selectWorkspacesWithResolvedNameForActiveProject = createSelector(
  selectWorkspacesForActiveProject,
  selectApiSpecs,
  (workspaces, apiSpecs) => {
    return workspaces.map(workspace => {
      if (isCollection(workspace)) {
        return workspace;
      }

      const apiSpec = apiSpecs.find(
        apiSpec => apiSpec.parentId === workspace._id
      );

      return {
        ...workspace,
        name: apiSpec?.fileName || workspace.name,
      };
    });
  }
);

export const selectActiveApiSpec = createSelector(
  selectApiSpecs,
  selectActiveWorkspace,
  (apiSpecs, activeWorkspace) => {
    if (!activeWorkspace) {
      // There should never be an active api spec without an active workspace
      return undefined;
    }
    return apiSpecs.find(apiSpec => apiSpec.parentId === activeWorkspace._id);
  }
);

export const selectActiveWorkspaceName = createSelector(
  selectActiveWorkspace,
  selectActiveApiSpec,
  (activeWorkspace, activeApiSpec) => {
    if (!activeWorkspace) {
      // see above, but since the selectActiveWorkspace selector really can return undefined, we need to handle it here.
      return undefined;
    }

    return isCollection(activeWorkspace) ? activeWorkspace.name : activeApiSpec?.fileName;
  }
);

export const selectEnvironments = createSelector(
  selectEntitiesLists,
  entities => entities.environments,
);

export const selectGitRepositories = createSelector(
  selectEntitiesLists,
  entities => entities.gitRepositories,
);

export const selectRequestGroups = createSelector(
  selectEntitiesLists,
  entities => entities.requestGroups,
);

export const selectRequestVersions = createSelector(
  selectEntitiesLists,
  entities => entities.requestVersions,
);

export const selectRequests = createSelector(
  selectEntitiesLists,
  entities => entities.requests,
);

export const selectActiveEnvironment = createSelector(
  selectActiveWorkspaceMeta,
  selectEnvironments,
  (meta, environments) => {
    if (!meta) {
      return null;
    }

    return environments.find(environment => environment._id === meta.activeEnvironmentId) || null;
  },
);

export const selectActiveWorkspaceClientCertificates = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => entities.clientCertificates.filter(c => c.parentId === activeWorkspace?._id),
);

export const selectActiveGitRepository = createSelector(
  selectEntitiesLists,
  selectActiveWorkspaceMeta,
  (entities, activeWorkspaceMeta) => {
    if (!activeWorkspaceMeta) {
      return null;
    }

    const id = activeWorkspaceMeta ? activeWorkspaceMeta.gitRepositoryId : 'n/a';
    const repo = entities.gitRepositories.find(r => r._id === id);
    return repo || null;
  },
);

export const selectCollapsedRequestGroups = createSelector(
  selectEntitiesLists,
  entities => {
    const collapsed: Record<string, boolean> = {};

    // Default all to collapsed
    for (const requestGroup of entities.requestGroups) {
      collapsed[requestGroup._id] = true;
    }

    // Update those that have metadata (not all do)
    for (const meta of entities.requestGroupMetas) {
      collapsed[meta.parentId] = meta.collapsed;
    }

    return collapsed;
  });

export const selectActiveWorkspaceEntities = createSelector(
  selectActiveWorkspace,
  selectEntitiesChildrenMap,
  (activeWorkspace, childrenMap) => {
    if (!activeWorkspace) {
      return [];
    }

    const descendants: BaseModel[] = [activeWorkspace];

    const addChildrenOf = (parent: any) => {
      // Don't add children of requests (eg. auth requests)
      if (isRequest(parent)) {
        return;
      }

      const children = childrenMap[parent._id] || [];

      for (const child of children) {
        descendants.push(child);
        addChildrenOf(child);
      }
    };

    // Kick off the recursion
    addChildrenOf(activeWorkspace);
    return descendants;
  },
);

export const selectPinnedRequests = createSelector(selectEntitiesLists, entities => {
  const pinned: Record<string, boolean> = {};
  const requests = [...entities.requests, ...entities.grpcRequests, ...entities.webSocketRequests];
  const requestMetas = [...entities.requestMetas, ...entities.grpcRequestMetas];

  // Default all to unpinned
  for (const request of requests) {
    pinned[request._id] = false;
  }

  // Update those that have metadata (not all do)
  for (const meta of requestMetas) {
    pinned[meta.parentId] = meta.pinned;
  }

  return pinned;
});

export const selectWorkspaceRequestsAndRequestGroups = createSelector(
  selectActiveWorkspaceEntities,
  entities => {
    return entities.filter(
      entity => isRequest(entity) || isWebSocketRequest(entity) || isGrpcRequest(entity) || isRequestGroup(entity),
    ) as (Request | WebSocketRequest | GrpcRequest | RequestGroup)[];
  },
);

export const selectActiveRequest = createSelector(
  selectEntities,
  selectActiveWorkspaceMeta,
  (entities, workspaceMeta) => {
    const id = workspaceMeta?.activeRequestId || 'n/a';

    if (id in entities.requests) {
      return entities.requests[id];
    }

    if (id in entities.grpcRequests) {
      return entities.grpcRequests[id];
    }

    if (id in entities.webSocketRequests) {
      return entities.webSocketRequests[id];
    }

    return null;
  },
);

export const selectActiveCookieJar = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, workspace) => {
    const cookieJar = entities.cookieJars.find(cj => cj.parentId === workspace?._id);
    return cookieJar || null;
  },
);

export const selectUnseenWorkspaces = createSelector(
  selectEntitiesLists,
  entities => {
    const { workspaces, workspaceMetas } = entities;
    return workspaces.filter(workspace => {
      const meta = workspaceMetas.find(m => m.parentId === workspace._id);
      return !!(meta && !meta.hasSeen);
    });
  });

export const selectActiveRequestMeta = createSelector(
  selectActiveRequest,
  selectEntitiesLists,
  (activeRequest, entities) => {
    const id = activeRequest?._id || 'n/a';
    return entities.requestMetas.find(m => m.parentId === id);
  },
);

export const selectResponsePreviewMode = createSelector(
  selectActiveRequestMeta,
  requestMeta => requestMeta?.previewMode || PREVIEW_MODE_SOURCE,
);

export const selectResponseFilter = createSelector(
  selectActiveRequestMeta,
  requestMeta => requestMeta?.responseFilter || '',
);

export const selectResponseFilterHistory = createSelector(
  selectActiveRequestMeta,
  requestMeta => requestMeta?.responseFilterHistory || [],
);

export const selectResponseDownloadPath = createSelector(
  selectActiveRequestMeta,
  requestMeta => requestMeta?.downloadPath || null,
);

export const selectHotKeyRegistry = createSelector(
  selectSettings,
  settings => settings.hotKeyRegistry,
);

export const selectActiveRequestResponses = createSelector(
  selectActiveRequest,
  selectEntitiesLists,
  selectActiveEnvironment,
  selectSettings,
  (activeRequest, entities, activeEnvironment, settings) => {
    const requestId = activeRequest ? activeRequest._id : 'n/a';

    const responses: (Response | WebSocketResponse)[] = (activeRequest && isWebSocketRequest(activeRequest)) ? entities.webSocketResponses : entities.responses;

    // Filter responses down if the setting is enabled
    return responses.filter(response => {
      const requestMatches = requestId === response.parentId;

      if (settings.filterResponsesByEnv) {
        const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
        const environmentMatches = response.environmentId === activeEnvironmentId;
        return requestMatches && environmentMatches;
      } else {
        return requestMatches;
      }
    })
      .sort((a, b) => (a.created > b.created ? -1 : 1));
  },
);

export const selectActiveResponse = createSelector(
  selectActiveRequestMeta,
  selectActiveRequestResponses,
  (activeRequestMeta, responses) => {
    const activeResponseId = activeRequestMeta ? activeRequestMeta.activeResponseId : 'n/a';

    const activeResponse = responses.find(response => response._id === activeResponseId);

    if (activeResponse) {
      return activeResponse;
    }

    return responses[0] || null;
  },
);

export const selectActiveUnitTestResult = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => {
    if (!activeWorkspace) {
      return null;
    }

    let recentResult: UnitTestResult | null = null;

    for (const r of entities.unitTestResults) {
      if (r.parentId !== activeWorkspace._id) {
        continue;
      }

      if (!recentResult) {
        recentResult = r;
        continue;
      }

      if (r.created > recentResult.created) {
        recentResult = r;
      }
    }

    return recentResult;
  },
);

export const selectActiveUnitTestSuite = createSelector(
  selectEntitiesLists,
  selectActiveWorkspaceMeta,
  (entities, activeWorkspaceMeta) => {
    if (!activeWorkspaceMeta) {
      return null;
    }

    const id = activeWorkspaceMeta.activeUnitTestSuiteId;
    return entities.unitTestSuites.find(s => s._id === id) || null;
  },
);

export const selectActiveUnitTests = createSelector(
  selectEntitiesLists,
  selectActiveUnitTestSuite,
  (entities, activeUnitTestSuite) => {
    if (!activeUnitTestSuite) {
      return [];
    }

    return entities.unitTests.filter(s => s.parentId === activeUnitTestSuite._id);
  },
);

export const selectActiveProjectName = createSelector(
  selectActiveProject,
  activeProject => activeProject.name,
);

export const selectActiveUnitTestSuites = createSelector(
  selectEntitiesLists,
  selectActiveWorkspace,
  (entities, activeWorkspace) => {
    return entities.unitTestSuites.filter(s => s.parentId === activeWorkspace?._id);
  },
);

export const selectSyncItems = createSelector(
  selectActiveWorkspaceEntities,
  getStatusCandidates,
);

export const selectIsLoggedIn = createSelector(
  selectGlobal,
  global => global.isLoggedIn,
);

export const selectActiveActivity = createSelector(
  selectGlobal,
  global => global.activeActivity,
);
