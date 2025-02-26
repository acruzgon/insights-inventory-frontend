/* eslint-disable camelcase */
import {
  Button,
  Pagination,
  PaginationVariant,
  SearchInput,
  Tooltip,
} from '@patternfly/react-core';
import {
  Table,
  TableBody,
  TableHeader,
  TableVariant,
  cellWidth,
  sortable,
} from '@patternfly/react-table';
import DateFormat from '@redhat-cloud-services/frontend-components/DateFormat';
import ErrorState from '@redhat-cloud-services/frontend-components/ErrorState';
import PrimaryToolbar from '@redhat-cloud-services/frontend-components/PrimaryToolbar';
import debounce from 'lodash/debounce';
import difference from 'lodash/difference';
import flatten from 'lodash/flatten';
import map from 'lodash/map';
import union from 'lodash/union';
import upperCase from 'lodash/upperCase';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  GENERAL_GROUPS_WRITE_PERMISSION,
  NO_MODIFY_GROUPS_TOOLTIP_MESSAGE,
  TABLE_DEFAULT_PAGINATION,
} from '../../constants';
import { fetchGroups } from '../../store/inventory-actions';
import useFetchBatched from '../../Utilities/hooks/useFetchBatched';
import CreateGroupModal from '../InventoryGroups/Modals/CreateGroupModal';
import DeleteGroupModal from '../InventoryGroups/Modals/DeleteGroupModal';
import RenameGroupModal from '../InventoryGroups/Modals/RenameGroupModal';
import { getGroups } from '../InventoryGroups/utils/api';
import { generateLoadingRows } from '../InventoryTable/helpers';
import NoEntitiesFound from '../InventoryTable/NoEntitiesFound';
import {
  readURLSearchParams,
  updateURLSearchParams,
} from '../../Utilities/URLSearchParams';
import { useLocation } from 'react-router-dom';
import isNil from 'lodash/isNil';
import { usePermissionsWithContext } from '@redhat-cloud-services/frontend-components-utilities/RBACHook';

const GROUPS_TABLE_INITIAL_STATE = {
  perPage: TABLE_DEFAULT_PAGINATION,
  page: 1,
};

const GROUPS_TABLE_COLUMNS = [
  {
    title: 'Name',
    transforms: [sortable, cellWidth(40)],
  },
  {
    title: 'Total systems',
    transforms: [sortable, cellWidth(20)],
  },
  {
    title: 'Last modified',
    transforms: [cellWidth(20)],
  },
];

const GROUPS_TABLE_COLUMNS_TO_URL = {
  0: '', // reserved for selection boxes
  1: 'name',
  2: 'host_ids',
  3: 'updated_at',
};

const REQUEST_DEBOUNCE_TIMEOUT = 500;

const groupsTableFiltersConfig = {
  name: {
    paramName: 'name',
  },
  perPage: {
    paramName: 'per_page',
    transformFromParam: (value) => parseInt(value),
  },
  page: {
    paramName: 'page',
    transformFromParam: (value) => parseInt(value),
  },
  sortIndex: {
    paramName: 'order_by',
    transformToParam: (value) => GROUPS_TABLE_COLUMNS_TO_URL[value],
    transformFromParam: (value) =>
      parseInt(
        Object.entries(GROUPS_TABLE_COLUMNS_TO_URL).find(
          ([, name]) => name === value
        )[0]
      ),
  },
  sortDirection: {
    paramName: 'order_how',
  },
};

const GroupsTable = () => {
  const dispatch = useDispatch();
  const { rejected, uninitialized, loading, data } = useSelector(
    (state) => state.groups
  );
  const location = useLocation();
  const [filters, setFilters] = useState({
    ...GROUPS_TABLE_INITIAL_STATE,
    ...readURLSearchParams(location.search, groupsTableFiltersConfig),
  });
  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(undefined); // for per-row actions
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const groups = useMemo(() => data?.results || [], [data]);
  const { fetchBatched } = useFetchBatched();
  const loadingState = uninitialized || loading;

  const { hasAccess: canModify } = usePermissionsWithContext([
    GENERAL_GROUPS_WRITE_PERMISSION,
  ]);

  const fetchData = useCallback(
    debounce((filters) => {
      const { perPage, page, sortIndex, sortDirection, ...search } = filters;

      if (sortIndex !== undefined && sortDirection !== undefined) {
        const order_by = GROUPS_TABLE_COLUMNS_TO_URL[sortIndex];
        const order_how = upperCase(sortDirection);
        return dispatch(
          fetchGroups(
            { ...search, order_by, order_how },
            { page, per_page: perPage }
          )
        );
      } else {
        return dispatch(fetchGroups(search, { page, per_page: perPage }));
      }
    }, REQUEST_DEBOUNCE_TIMEOUT), // wait the timeout before making the final fetch
    []
  );

  useEffect(() => {
    updateURLSearchParams(filters, groupsTableFiltersConfig);
    fetchData(filters);
  }, [filters]);

  useEffect(() => {
    // update visible rows once new data obtained
    const newRows = groups.map((group, index) => ({
      cells: [
        <span key={index}>
          <Link to={`groups/${group.id}`}>{group.name || group.id}</Link>
        </span>,
        <span key={index}>
          {isNil(group.host_count) ? 'N/A' : group.host_count.toString()}
        </span>,
        <span key={index}>
          {isNil(group.updated) ? 'N/A' : <DateFormat date={group.updated} />}
        </span>,
      ],
      groupId: group.id,
      groupName: group.name,
      selected: selectedIds.includes(group.id),
    }));
    setRows(newRows);

    if (selectedIds.length === 1) {
      setSelectedGroup({
        id: selectedIds[0],
        name: groups.find(({ id }) => id === selectedIds[0])?.name,
      });
    } else {
      setSelectedGroup(undefined);
    }
  }, [groups, selectedIds]);

  // TODO: convert initial URL params to filters

  const onSort = (event, index, direction) => {
    setFilters({ ...filters, sortIndex: index, sortDirection: direction });
  };

  const filterConfigItems = useMemo(
    () => [
      {
        type: 'custom',
        label: 'Name',
        filterValues: {
          children: (
            <SearchInput
              data-ouia-component-type="PF4/TextInput"
              data-ouia-component-id="name-filter"
              placeholder="Filter by name"
              value={filters.name || ''}
              onChange={(value) => {
                const { name, ...fs } = filters;
                return setFilters({
                  ...fs,
                  ...(value.length > 0 ? { name: value } : {}),
                });
              }}
              onClear={() => {
                const { name, ...fs } = filters;
                return setFilters(fs);
              }}
              isDisabled={rejected}
            />
          ),
        },
      },
    ],
    [filters.name, rejected]
  );

  const onResetFilters = () => setFilters(GROUPS_TABLE_INITIAL_STATE);

  const activeFiltersConfig = {
    showDeleteButton: !!filters.name,
    deleteTitle: 'Reset filters',
    filters: filters.name
      ? [
          {
            category: 'Name',
            chips: [{ name: filters.name, value: filters.name }],
          },
        ]
      : [],
    // always reset to initial filters since there is only one filter currently
    onDelete: onResetFilters,
  };

  const onSetPage = (event, page) => setFilters({ ...filters, page });

  const onPerPageSelect = (event, perPage) =>
    setFilters({ ...filters, perPage, page: 1 }); // will also reset the page to first

  const tableRows = useMemo(
    () =>
      uninitialized || loading
        ? generateLoadingRows(GROUPS_TABLE_COLUMNS.length, filters.perPage)
        : rejected || rows.length === 0
        ? [
            {
              fullWidth: true,
              cells: [
                {
                  title: rejected ? (
                    // TODO: don't render the primary button (requires change in FF)
                    <ErrorState />
                  ) : (
                    <NoEntitiesFound
                      entities="groups"
                      onClearAll={onResetFilters}
                    />
                  ),
                  props: {
                    colSpan: GROUPS_TABLE_COLUMNS.length + 1,
                  },
                },
              ],
            },
          ]
        : rows,
    [uninitialized, loading, rejected, rows, filters.perPage]
  );

  // TODO: use ouiaSafe to indicate the loading state for e2e tests

  const onSelect = (event, isSelected, rowId, rowData) => {
    const { groupId } = rowData;
    if (isSelected) {
      setSelectedIds(union(selectedIds, [groupId]));
    } else {
      setSelectedIds(difference(selectedIds, [groupId]));
    }
  };

  const fetchAllGroupIds = useCallback((filters, total) => {
    const { sortIndex, sortDirection, perPage, page, ...search } = filters;
    // exclude sort parameters

    return fetchBatched(getGroups, total, search);
  }, []);

  const selectAllIds = async () => {
    const results = await fetchAllGroupIds(filters, data?.total);
    const ids = map(flatten(map(results, 'results')), 'id');
    setSelectedIds(ids);
  };

  const allSelected = selectedIds.length === data?.total;
  const noneSelected = selectedIds.length === 0;
  const displayedIds = map(rows, 'groupId');
  const pageSelected = difference(displayedIds, selectedIds).length === 0;

  return (
    <div id="groups-table">
      {createModalOpen && (
        <CreateGroupModal
          isModalOpen={createModalOpen}
          setIsModalOpen={setCreateModalOpen}
          reloadData={() => {
            fetchData(filters);
          }}
        />
      )}
      {renameModalOpen && (
        <RenameGroupModal
          isModalOpen={renameModalOpen}
          setIsModalOpen={(value) => {
            if (value === false) {
              setSelectedGroup(undefined);
            }

            setRenameModalOpen(value);
          }}
          reloadData={() => fetchData(filters)}
          modalState={selectedGroup}
        />
      )}
      {deleteModalOpen && (
        <DeleteGroupModal
          isModalOpen={deleteModalOpen}
          setIsModalOpen={(value) => {
            if (value === false) {
              setSelectedGroup(undefined);
            }

            setDeleteModalOpen(value);
          }}
          reloadData={() => {
            fetchData(filters);
            setSelectedIds([]);
          }}
          groupIds={
            selectedGroup !== undefined ? [selectedGroup.id] : selectedIds
          }
        />
      )}
      <PrimaryToolbar
        pagination={{
          itemCount: data?.total || 0,
          page: filters.page,
          perPage: filters.perPage,
          onSetPage,
          onPerPageSelect,
          isCompact: true,
          ouiaId: 'pager',
          isDisabled: rejected,
        }}
        filterConfig={{ items: filterConfigItems }}
        activeFiltersConfig={activeFiltersConfig}
        bulkSelect={{
          items: [
            {
              title: 'Select none',
              onClick: () => setSelectedIds([]),
              props: { isDisabled: noneSelected },
            },
            {
              title: `${pageSelected ? 'Deselect' : 'Select'} page (${
                data?.count || 0
              } items)`,
              onClick: () => {
                if (pageSelected) {
                  // exclude groups on the page from the selected ids
                  const newRows = difference(selectedIds, displayedIds);
                  setSelectedIds(newRows);
                } else {
                  setSelectedIds(union(selectedIds, displayedIds));
                }
              },
            },
            {
              title: `${allSelected ? 'Deselect' : 'Select'} all (${
                data?.total || 0
              } items)`,
              onClick: async () => {
                if (allSelected) {
                  setSelectedIds([]);
                } else {
                  await selectAllIds();
                }
              },
            },
          ],
          checked: selectedIds.length > 0, // TODO: support partial selection (dash sign) in FEC BulkSelect
          onSelect: async (checked) => {
            if (checked) {
              await selectAllIds();
            } else {
              setSelectedIds([]);
            }
          },
          ouiaId: 'groups-selector',
          count: selectedIds.length,
        }}
        actionsConfig={{
          actions: [
            !canModify ? ( // custom component needed since it's the first action to render (see primary toolbar implementation)
              <Tooltip content="You do not have the necessary permissions to modify groups. Contact your organization administrator.">
                <Button isAriaDisabled>Create group</Button>
              </Tooltip>
            ) : (
              {
                label: 'Create group',
                onClick: () => setCreateModalOpen(true),
              }
            ),
            {
              label: 'Rename group',
              onClick: () => setRenameModalOpen(true),
              props: {
                isAriaDisabled: !canModify || selectedIds.length !== 1,
                ...(!canModify && {
                  tooltip: NO_MODIFY_GROUPS_TOOLTIP_MESSAGE,
                }),
              },
            },
            {
              label: selectedIds.length > 1 ? 'Delete groups' : 'Delete group',
              onClick: () => setDeleteModalOpen(true),
              props: {
                isAriaDisabled: !canModify || selectedIds.length === 0,
                ...(!canModify && {
                  tooltip: NO_MODIFY_GROUPS_TOOLTIP_MESSAGE,
                }),
              },
            },
          ],
        }}
      />
      <Table
        aria-label="Groups table"
        ouiaId="groups-table"
        ouiaSafe={!loadingState}
        variant={TableVariant.compact}
        cells={GROUPS_TABLE_COLUMNS}
        rows={tableRows}
        sortBy={{
          index: filters.sortIndex,
          direction: filters.sortDirection,
        }}
        onSort={onSort}
        isStickyHeader
        onSelect={onSelect}
        actions={[
          {
            title: 'Rename group',
            onClick: (event, rowIndex, { groupId, groupName }) => {
              setSelectedGroup({
                id: groupId,
                name: groupName,
              });
              setRenameModalOpen(true);
            },
            ...(!canModify && {
              tooltip: !canModify
                ? 'You do not have the necessary permissions to modify this group. Contact your organization administrator.'
                : '',
              isAriaDisabled: true,
            }),
          },
          {
            title: 'Delete group',
            onClick: (event, rowIndex, { groupId, groupName }) => {
              setSelectedGroup({
                id: groupId,
                name: groupName,
              });
              setDeleteModalOpen(true);
            },
            ...(!canModify && {
              tooltip: !canModify
                ? 'You do not have the necessary permissions to modify this group. Contact your organization administrator.'
                : '',
              isAriaDisabled: true,
            }),
          },
        ]}
        canSelectAll={false}
      >
        <TableHeader />
        <TableBody />
      </Table>
      <Pagination
        itemCount={data?.total || 0}
        page={filters.page}
        perPage={filters.perPage}
        onSetPage={onSetPage}
        onPerPageSelect={onPerPageSelect}
        variant={PaginationVariant.bottom}
        widgetId={`pagination-options-menu-bottom`}
        ouiaId="pager"
        isDisabled={rejected}
      />
    </div>
  );
};

export default GroupsTable;
