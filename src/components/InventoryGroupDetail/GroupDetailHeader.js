/* eslint-disable rulesdir/disallow-fec-relative-imports */
import {
  Breadcrumb,
  BreadcrumbItem,
  Dropdown,
  DropdownItem,
  DropdownToggle,
  Flex,
  FlexItem,
  Skeleton,
} from '@patternfly/react-core';
import {
  PageHeader,
  PageHeaderTitle,
} from '@redhat-cloud-services/frontend-components';
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useHistory } from 'react-router-dom';
import { routes } from '../../Routes';
import PropTypes from 'prop-types';
import DeleteGroupModal from '../InventoryGroups/Modals/DeleteGroupModal';
import RenameGroupModal from '../InventoryGroups/Modals/RenameGroupModal';
import { fetchGroupDetail } from '../../store/inventory-actions';
import { usePermissionsWithContext } from '@redhat-cloud-services/frontend-components-utilities/RBACHook';
import {
  REQUIRED_PERMISSIONS_TO_MODIFY_GROUP,
  REQUIRED_PERMISSIONS_TO_READ_GROUP,
} from '../../constants';

const GroupDetailHeader = ({ groupId }) => {
  const dispatch = useDispatch();
  const { uninitialized, loading, data } = useSelector(
    (state) => state.groupDetail
  );

  const { hasAccess: canRead } = usePermissionsWithContext(
    REQUIRED_PERMISSIONS_TO_READ_GROUP(groupId)
  );

  const { hasAccess: canModify } = usePermissionsWithContext(
    REQUIRED_PERMISSIONS_TO_MODIFY_GROUP(groupId)
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const name = data?.results?.[0]?.name;

  const getTitle = () => {
    if (canRead) {
      if (uninitialized || loading) {
        return (
          <Skeleton width="250px" screenreaderText="Loading group details" />
        );
      } else {
        return name || groupId; // in case of error, render just id from URL
      }
    }

    return groupId;
  };

  const history = useHistory();

  return (
    <PageHeader>
      {renameModalOpen && (
        <RenameGroupModal
          isModalOpen={renameModalOpen}
          setIsModalOpen={() => setRenameModalOpen(false)}
          modalState={{
            id: groupId,
            name: canRead ? name || groupId : groupId,
          }}
          reloadData={() => dispatch(fetchGroupDetail(groupId))}
        />
      )}
      {deleteModalOpen && (
        <DeleteGroupModal
          isModalOpen={deleteModalOpen}
          setIsModalOpen={() => setDeleteModalOpen(false)}
          reloadData={() => history.push('/groups')}
          groupIds={[groupId]}
        />
      )}
      <Breadcrumb>
        <BreadcrumbItem>
          <Link to={routes.groups}>Groups</Link>
        </BreadcrumbItem>
        <BreadcrumbItem isActive>{getTitle()}</BreadcrumbItem>
      </Breadcrumb>
      <Flex
        id="group-header"
        justifyContent={{ default: 'justifyContentSpaceBetween' }}
      >
        <FlexItem>
          <PageHeaderTitle title={getTitle()} />
        </FlexItem>
        <FlexItem id="group-header-dropdown">
          <Dropdown
            onSelect={() => setDropdownOpen(!dropdownOpen)}
            autoFocus={false}
            isOpen={dropdownOpen}
            toggle={
              <DropdownToggle
                id="group-dropdown-toggle"
                onToggle={(isOpen) => setDropdownOpen(isOpen)}
                toggleVariant="secondary"
                isDisabled={!canModify || uninitialized || loading}
                ouiaId="group-actions-dropdown-toggle"
              >
                Group actions
              </DropdownToggle>
            }
            dropdownItems={[
              <DropdownItem
                key="rename-group"
                onClick={() => setRenameModalOpen(true)}
              >
                Rename
              </DropdownItem>,
              <DropdownItem
                key="delete-group"
                onClick={() => setDeleteModalOpen(true)}
              >
                Delete
              </DropdownItem>,
            ]}
          />
        </FlexItem>
      </Flex>
    </PageHeader>
  );
};

GroupDetailHeader.propTypes = {
  groupId: PropTypes.string.isRequired,
};

export default GroupDetailHeader;
