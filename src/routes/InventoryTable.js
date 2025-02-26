/* eslint-disable camelcase */
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import './inventory.scss';
import {
  PageHeader,
  PageHeaderTitle,
} from '@redhat-cloud-services/frontend-components/PageHeader';
import Main from '@redhat-cloud-services/frontend-components/Main';
import * as actions from '../store/actions';
import {
  Button,
  Grid,
  GridItem,
  Tab,
  TabTitleText,
  Tabs,
  Tooltip,
} from '@patternfly/react-core';
import { addNotification as addNotificationAction } from '@redhat-cloud-services/frontend-components-notifications/redux';
import DeleteModal from '../Utilities/DeleteModal';
import { TextInputModal } from '../components/SystemDetails/GeneralInfo';
import flatMap from 'lodash/flatMap';
import {
  HOST_GROUP_CHIP,
  RHCD_FILTER_KEY,
  UPDATE_METHOD_KEY,
  generateFilter,
  useHostsWritePermissions,
} from '../Utilities/constants';
import { InventoryTable as InventoryTableCmp } from '../components/InventoryTable';
import useChrome from '@redhat-cloud-services/frontend-components/useChrome';
import AddSelectedHostsToGroupModal from '../components/InventoryGroups/Modals/AddSelectedHostsToGroupModal';
import useFeatureFlag from '../Utilities/useFeatureFlag';
import AsyncComponent from '@redhat-cloud-services/frontend-components/AsyncComponent';
import { useBulkSelectConfig } from '../Utilities/hooks/useBulkSelectConfig';
import RemoveHostsFromGroupModal from '../components/InventoryGroups/Modals/RemoveHostsFromGroupModal';
import { manageEdgeInventoryUrlName } from '../Utilities/edge';
import { resolveRelPath } from '../Utilities/path';
import { usePermissionsWithContext } from '@redhat-cloud-services/frontend-components-utilities/RBACHook';
import {
  GENERAL_GROUPS_WRITE_PERMISSION,
  NO_MODIFY_GROUPS_TOOLTIP_MESSAGE,
  NO_MODIFY_HOSTS_TOOLTIP_MESSAGE,
} from '../constants';
const mapTags = ({ category, values }) =>
  values.map(
    ({ tagKey, value }) =>
      `${category ? `${category}/` : ''}${tagKey}${value ? `=${value}` : ''}`
  );

const filterMapper = {
  staleFilter: ({ staleFilter }, searchParams) =>
    staleFilter.forEach((item) => searchParams.append('status', item)),
  osFilter: ({ osFilter }, searchParams) =>
    osFilter?.forEach((item) => searchParams.append('operating_system', item)),
  registeredWithFilter: ({ registeredWithFilter }, searchParams) =>
    registeredWithFilter?.forEach((item) =>
      searchParams.append('source', item)
    ),
  value: ({ value, filter }, searchParams) =>
    value === 'hostname_or_id' &&
    Boolean(filter) &&
    searchParams.append('hostname_or_id', filter),
  tagFilters: ({ tagFilters }, searchParams) =>
    tagFilters?.length > 0 &&
    searchParams.append('tags', flatMap(tagFilters, mapTags)),
  rhcdFilter: ({ rhcdFilter }, searchParams) =>
    rhcdFilter?.forEach((item) => searchParams.append(RHCD_FILTER_KEY, item)),
  lastSeenFilter: ({ lastSeenFilter }, searchParams) =>
    Object.keys(lastSeenFilter || {})?.forEach(
      (item) =>
        item === 'mark' &&
        searchParams.append('last_seen', lastSeenFilter[item])
    ),
  updateMethodFilter: ({ updateMethodFilter }, searchParams) =>
    updateMethodFilter?.forEach((item) =>
      searchParams.append(UPDATE_METHOD_KEY, item)
    ),
  hostGroupFilter: ({ hostGroupFilter }, searchParams) =>
    hostGroupFilter?.forEach((item) =>
      searchParams.append(HOST_GROUP_CHIP, item)
    ),
};

const calculateFilters = (searchParams, filters = []) => {
  filters.forEach((filter) => {
    Object.keys(filter).forEach((key) => {
      filterMapper?.[key]?.(filter, searchParams);
    });
  });
  return searchParams;
};

export const calculatePagination = (searchParams, page, perPage) => {
  const currSearch = new URLSearchParams(location.search);
  const newPage = page !== undefined ? page : currSearch.get('page');
  const newPerPage =
    perPage !== undefined ? perPage : currSearch.get('per_page');
  !isNaN(parseInt(newPage)) && searchParams.append('page', newPage);
  !isNaN(parseInt(newPerPage)) && searchParams.append('per_page', newPerPage);
};

const Inventory = ({
  status,
  source,
  filterbyName,
  tagsFilter,
  operatingSystem,
  rhcdFilter,
  updateMethodFilter,
  lastSeenFilter,
  page,
  perPage,
  initialLoading,
  hasAccess,
  hostGroupFilter,
}) => {
  const history = useHistory();
  const chrome = useChrome();
  const inventory = useRef(null);
  const [isModalOpen, handleModalToggle] = useState(false);
  const [currentSystem, setCurrentSystem] = useState({});
  const [filters, onSetfilters] = useState(
    generateFilter(
      status,
      source,
      tagsFilter,
      filterbyName,
      operatingSystem,
      rhcdFilter,
      updateMethodFilter,
      hostGroupFilter,
      lastSeenFilter
    )
  );
  const { pathname } = useLocation();
  const tabsPath = [
    resolveRelPath(''),
    resolveRelPath(manageEdgeInventoryUrlName),
  ];
  const initialActiveTabKey =
    tabsPath.indexOf(pathname) >= 0 ? tabsPath.indexOf(pathname) : 0;
  const [activeTabKey, setActiveTabKey] = useState(initialActiveTabKey);
  useEffect(() => {
    setActiveTabKey(initialActiveTabKey);
  }, [pathname]);
  const handleTabClick = (_event, tabIndex) => {
    const tabPath = tabsPath[tabIndex];
    if (tabPath !== undefined) {
      history.push(`${tabPath}`);
    }
    setActiveTabKey(tabIndex);
  };
  const [ediOpen, onEditOpen] = useState(false);
  const [addHostGroupModalOpen, setAddHostGroupModalOpen] = useState(false);
  const [removeHostsFromGroupModalOpen, setRemoveHostsFromGroupModalOpen] =
    useState(false);
  const [globalFilter, setGlobalFilter] = useState();
  const hostsWritePermissions = useHostsWritePermissions();
  const rows = useSelector(({ entities }) => entities?.rows, shallowEqual);
  const loaded = useSelector(({ entities }) => entities?.loaded);
  const selected = useSelector(({ entities }) => entities?.selected);
  const total = useSelector(({ entities }) => entities?.total);
  const dispatch = useDispatch();
  const groupsEnabled = useFeatureFlag('hbi.ui.inventory-groups');
  const bulkSelectConfig = useBulkSelectConfig(
    selected,
    globalFilter,
    total,
    rows,
    loaded
  );

  const onRefresh = (options, callback) => {
    onSetfilters(options?.filters);
    const searchParams = new URLSearchParams();
    calculateFilters(searchParams, options?.filters);
    // eslint-disable-next-line camelcase
    calculatePagination(searchParams, options?.page, options?.per_page);
    const search = searchParams.toString();
    history.push({
      search,
      hash: location.hash,
    });

    if (callback) {
      callback(options);
    }
  };

  const EdgeParityEnabled = useFeatureFlag('edgeParity.inventory-list');

  const { hasAccess: canModifyGroups } = usePermissionsWithContext([
    GENERAL_GROUPS_WRITE_PERMISSION,
  ]);

  useEffect(() => {
    chrome.updateDocumentTitle('Systems | Red Hat Insights');
    chrome?.hideGlobalFilter?.(false);
    chrome.appAction('system-list');
    chrome.appObjectId();
    chrome.on('GLOBAL_FILTER_UPDATE', ({ data }) => {
      const [workloads, SID, tags] = chrome.mapGlobalFilter(data, false, true);
      setGlobalFilter({
        tags,
        filter: {
          ...globalFilter?.filter,
          system_profile: {
            ...globalFilter?.filter?.system_profile,
            ...(workloads?.SAP?.isSelected && { sap_system: true }),
            ...(workloads &&
              workloads['Ansible Automation Platform']?.isSelected && {
                ansible: 'not_nil',
              }),
            ...(workloads?.['Microsoft SQL']?.isSelected && {
              mssql: 'not_nil',
            }),
            ...(SID?.length > 0 && { sap_sids: SID }),
          },
        },
      });
    });
    dispatch(actions.clearNotifications());

    if (perPage || page) {
      dispatch(
        actions.setPagination(
          Array.isArray(page) ? page[0] : page,
          Array.isArray(perPage) ? perPage[0] : perPage
        )
      );
    }

    return () => {
      dispatch(actions.clearEntitiesAction());
    };
  }, []);

  const calculateSelected = () => (selected ? selected.size : 0);

  const isBulkRemoveFromGroupsEnabled = () => {
    if (canModifyGroups && calculateSelected() > 0) {
      const selectedHosts = Array.from(selected.values());

      return selectedHosts.every(
        ({ groups }) =>
          groups.length !== 0 &&
          groups[0].name === selectedHosts[0].groups[0].name
      );
    }

    return false;
  };

  const isBulkAddHostsToGroupsEnabled = () => {
    if (canModifyGroups && calculateSelected() > 0) {
      const selectedHosts = Array.from(selected.values());

      return selectedHosts.every(({ groups }) => groups.length === 0);
    }

    return false;
  };

  //This wrapping of table actions allows to pass feature flag status and receive a prepared array of actions
  const tableActions = (groupsUiStatus, row) => {
    const standardActions = [
      {
        title: 'Edit',
        onClick: (_event, _index, rowData) => {
          setCurrentSystem(rowData);
          onEditOpen(() => true);
        },
        ...(!hostsWritePermissions && {
          isAriaDisabled: true,
          tooltip: NO_MODIFY_HOSTS_TOOLTIP_MESSAGE,
        }),
      },
      {
        title: 'Delete',
        onClick: (_event, _index, rowData) => {
          setCurrentSystem(rowData);
          handleModalToggle(() => true);
        },
        ...(!hostsWritePermissions && {
          isAriaDisabled: true,
          tooltip: NO_MODIFY_HOSTS_TOOLTIP_MESSAGE,
        }),
      },
    ];

    const actionsBehindFeatureFlag = [
      {
        title: 'Add to group',
        onClick: (_event, _index, rowData) => {
          setCurrentSystem([rowData]);
          setAddHostGroupModalOpen(true);
        },
        isAriaDisabled: row.groups.length > 0 || !canModifyGroups,
        ...(!canModifyGroups && {
          tooltip: NO_MODIFY_GROUPS_TOOLTIP_MESSAGE,
        }),
      },
      {
        title: 'Remove from group',
        onClick: (event, index, rowData) => {
          setCurrentSystem([rowData]);
          setRemoveHostsFromGroupModalOpen(true);
        },
        isAriaDisabled: row.groups.length === 0 || !canModifyGroups,
        ...(!canModifyGroups && {
          tooltip: NO_MODIFY_GROUPS_TOOLTIP_MESSAGE,
        }),
      },
    ];

    return [
      ...(groupsUiStatus ? actionsBehindFeatureFlag : []),
      ...standardActions,
    ];
  };

  const traditionalDevices = (
    <Grid gutter="md">
      <GridItem span={12}>
        <InventoryTableCmp
          hasAccess={hasAccess}
          isRbacEnabled
          customFilters={{ filters, globalFilter }}
          isFullView
          showTags
          onRefresh={onRefresh}
          hasCheckbox
          autoRefresh
          ignoreRefresh
          initialLoading={initialLoading}
          ref={inventory}
          tableProps={{
            actionResolver: (row) => tableActions(groupsEnabled, row),
            canSelectAll: false,
          }}
          actionsConfig={{
            actions: [
              !hostsWritePermissions ? ( // custom component needed since it's the first action to render (see primary toolbar implementation)
                <Tooltip content={NO_MODIFY_HOSTS_TOOLTIP_MESSAGE}>
                  <Button isAriaDisabled>Delete</Button>
                </Tooltip>
              ) : (
                {
                  label: 'Delete',
                  props: {
                    isAriaDisabled: calculateSelected() === 0,
                    variant: 'secondary',
                    onClick: () => {
                      setCurrentSystem(Array.from(selected.values()));
                      handleModalToggle(true);
                    },
                  },
                }
              ),
              ...(groupsEnabled
                ? [
                    {
                      label: 'Add to group',
                      props: {
                        isAriaDisabled: !isBulkAddHostsToGroupsEnabled(),
                        ...(!canModifyGroups && {
                          tooltip: NO_MODIFY_GROUPS_TOOLTIP_MESSAGE,
                        }),
                      },
                      onClick: () => {
                        setCurrentSystem(Array.from(selected.values()));
                        setAddHostGroupModalOpen(true);
                      },
                    },
                    {
                      label: 'Remove from group',
                      props: {
                        isAriaDisabled: !isBulkRemoveFromGroupsEnabled(),
                        ...(!canModifyGroups && {
                          tooltip: NO_MODIFY_GROUPS_TOOLTIP_MESSAGE,
                        }),
                      },
                      onClick: () => {
                        setCurrentSystem(Array.from(selected.values()));
                        setRemoveHostsFromGroupModalOpen(true);
                      },
                    },
                  ]
                : []),
            ],
          }}
          bulkSelect={bulkSelectConfig}
          onRowClick={(_e, id, app) =>
            history.push(`/${id}${app ? `/${app}` : ''}`)
          }
        />
      </GridItem>
    </Grid>
  );

  return (
    <React.Fragment>
      <PageHeader className="pf-m-light">
        <PageHeaderTitle title="Systems" />
      </PageHeader>
      <Main>
        {EdgeParityEnabled ? (
          <Tabs
            className="pf-m-light pf-c-table"
            activeKey={activeTabKey}
            onSelect={handleTabClick}
          >
            <Tab
              eventKey={0}
              title={<TabTitleText>Conventional (RPM-DNF)</TabTitleText>}
            >
              {traditionalDevices}
            </Tab>
            <Tab
              eventKey={1}
              title={<TabTitleText>Immutable (OSTree)</TabTitleText>}
            >
              <AsyncComponent
                appName="edge"
                module="./Inventory"
                historyProp={useHistory}
                locationProp={useLocation}
                showHeaderProp={false}
                pathPrefix={resolveRelPath('')}
                urlName={manageEdgeInventoryUrlName}
              />
            </Tab>
          </Tabs>
        ) : (
          traditionalDevices
        )}
      </Main>
      <DeleteModal
        className="sentry-mask data-hj-suppress"
        handleModalToggle={handleModalToggle}
        isModalOpen={isModalOpen}
        currentSytems={currentSystem}
        onConfirm={() => {
          let displayName;
          let removeSystems;
          if (Array.isArray(currentSystem)) {
            removeSystems = currentSystem.map(({ id }) => id);
            displayName =
              currentSystem.length > 1
                ? `${currentSystem.length} systems`
                : currentSystem[0].display_name;
          } else {
            displayName = currentSystem.display_name;
            removeSystems = [currentSystem.id];
          }

          dispatch(
            addNotificationAction({
              id: 'remove-initiated',
              variant: 'warning',
              title: 'Delete operation initiated',
              description: `Removal of ${displayName} started.`,
              dismissable: false,
            })
          );
          dispatch(actions.deleteEntity(removeSystems, displayName));
          handleModalToggle(false);
        }}
      />
      <TextInputModal
        title="Edit display name"
        isOpen={ediOpen}
        value={currentSystem.display_name}
        onCancel={() => onEditOpen(false)}
        onSubmit={(value) => {
          dispatch(actions.editDisplayName(currentSystem.id, value));
          onEditOpen(false);
        }}
      />
      {groupsEnabled === true && (
        <>
          {addHostGroupModalOpen && (
            <AddSelectedHostsToGroupModal
              isModalOpen={addHostGroupModalOpen}
              setIsModalOpen={setAddHostGroupModalOpen}
              modalState={currentSystem}
              reloadData={() => {
                if (calculateSelected() > 0) {
                  dispatch(actions.selectEntity(-1, false));
                }

                inventory.current.onRefreshData(filters, false, true);
              }}
            />
          )}
          {removeHostsFromGroupModalOpen && (
            <RemoveHostsFromGroupModal
              isModalOpen={removeHostsFromGroupModalOpen}
              setIsModalOpen={setRemoveHostsFromGroupModalOpen}
              modalState={currentSystem}
              reloadData={() => {
                if (calculateSelected() > 0) {
                  dispatch(actions.selectEntity(-1, false));
                }

                inventory.current.onRefreshData(filters, false, true);
              }}
            />
          )}
        </>
      )}
    </React.Fragment>
  );
};

Inventory.propTypes = {
  status: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.string,
  ]),
  source: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.string,
  ]),
  operatingSystem: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.string,
  ]),
  filterbyName: PropTypes.arrayOf(PropTypes.string),
  tagsFilter: PropTypes.any,
  page: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ),
  perPage: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ),
  initialLoading: PropTypes.bool,
  rhcdFilter: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.string,
  ]),
  updateMethodFilter: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.string,
  ]),
  hasAccess: PropTypes.bool,
  hostGroupFilter: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.string,
  ]),
  lastSeenFilter: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.string,
  ]),
};

Inventory.defaultProps = {
  initialLoading: true,
};

export default Inventory;
