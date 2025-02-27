import {
  Button,
  FilterRowsData,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectAll,
  TableSelectRow,
  DataTableSkeleton,
  Link,
  Pagination,
  Search,
  SearchSkeleton,
  DataTable,
} from "carbon-components-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./offline-actions-table.styles.scss";
import {
  usePagination,
  useLayoutType,
  navigate,
  SyncItem,
} from "@openmrs/esm-framework";

export interface OfflineActionsTableProps {
  isLoading: boolean;
  data?: Array<SyncItemWithPatient>;
  disableEditing: boolean;
  disableDelete: boolean;
  onDelete(syncItemIds: Array<number>): void;
}

export interface SyncItemWithPatient {
  item: SyncItem;
  patient?: fhir.Patient;
}

const OfflineActionsTable: React.FC<OfflineActionsTableProps> = ({
  isLoading,
  data = [],
  disableEditing,
  disableDelete,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(10);
  const { results, currentPage, goTo } = usePagination(data);
  const layout = useLayoutType();
  const toolbarItemSize = layout === "desktop" ? "sm" : undefined;

  const headers = [
    {
      key: "createdOn",
      header: t("offlineActionsTableCreatedOn", "Date & Time"),
    },
    {
      key: "patient",
      header: t("offlineActionsTablePatient", "Patient"),
    },
    {
      key: "action",
      header: t("offlineActionsTableAction", "Action"),
    },
    {
      key: "error",
      header: t("offlineActionsTableError", "Error"),
    },
  ];

  const rows = results.map((syncItem, i) => {
    const patientName = getPatientName(syncItem);

    return {
      id: syncItem.item.id.toString(),
      createdOn: syncItem.item.createdOn?.toLocaleDateString(),
      patient: {
        value: (
          <PatientLink
            patientUuid={syncItem.item.descriptor?.patientUuid}
            patientName={patientName}
          />
        ),
        filterableValue: patientName,
      },
      action: syncItem.item.descriptor?.displayName,
      error: syncItem.item.lastError?.message ?? "-",
    };
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <DataTable rows={rows} headers={headers} filterRows={filterTableRows}>
      {({
        rows,
        headers,
        getTableProps,
        getHeaderProps,
        getRowProps,
        getTableContainerProps,
        getSelectionProps,
        onInputChange,
        selectedRows,
      }) => (
        <TableContainer
          className={styles.tableContainer}
          {...getTableContainerProps()}
        >
          <div className={styles.tableHeaderContainer}>
            {selectedRows.length === 0 && (
              <Search
                className={styles.tableSearch}
                labelText={t(
                  "offlinePatientsTableSearchLabel",
                  "Search this list"
                )}
                placeholder={t(
                  "offlinePatientsTableSearchPlaceholder",
                  "Search this list"
                )}
                size={toolbarItemSize}
                onChange={onInputChange}
                light
              />
            )}
            {selectedRows.length > 0 && (
              <Button
                className={styles.tablePrimaryAction}
                kind="danger"
                size={toolbarItemSize}
                disabled={disableEditing || disableDelete}
                onClick={() => onDelete(selectedRows.map((row) => +row.id))}
              >
                {selectedRows.length === 1
                  ? t("offlineActionsTableDeleteAction", "Delete action")
                  : t(
                      "offlineActionsTableDeleteActions",
                      "Delete {count} actions",
                      { count: selectedRows.length }
                    )}
              </Button>
            )}
          </div>
          <Table {...getTableProps()} isSortable useZebraStyles>
            <TableHead>
              <TableRow>
                <TableSelectAll
                  {...getSelectionProps()}
                  disabled={disableEditing}
                />
                {headers.map((header) => (
                  <TableHeader {...getHeaderProps({ header })} isSortable>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow {...getRowProps({ row })}>
                  <TableSelectRow
                    {...getSelectionProps({ row })}
                    disabled={disableEditing}
                  />
                  {row.cells.map((cell) => (
                    <TableCell key={cell.id}>
                      {cell.value?.value ?? cell.value}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            pageSizes={[10, 20, 30, 40, 50]}
            page={currentPage}
            pageSize={pageSize}
            totalItems={data.length}
            onChange={({ page, pageSize }) => {
              goTo(page);
              setPageSize(pageSize);
            }}
          />
        </TableContainer>
      )}
    </DataTable>
  );
};

const TableSkeleton: React.FC = () => {
  return (
    <TableContainer className={styles.tableContainer}>
      <div className={styles.tableHeaderContainer}>
        <SearchSkeleton className={styles.tableSearch} />
      </div>
      <DataTableSkeleton showToolbar={false} showHeader={false} />
    </TableContainer>
  );
};

function getPatientName({ item, patient }: SyncItemWithPatient) {
  const hasPatient = item.descriptor?.patientUuid;
  if (!hasPatient) {
    return undefined;
  }

  const patientName = patient?.name?.[0];
  return patientName
    ? `${patientName.given.join(" ")} ${patientName.family}`
    : item.descriptor.patientUuid;
}

function PatientLink({ patientUuid, patientName }) {
  return patientUuid ? (
    <Link
      onClick={() =>
        navigate({
          to: `${window.getOpenmrsSpaBase()}patient/${patientUuid}/chart`,
        })
      }
    >
      {patientName}
    </Link>
  ) : (
    <>-</>
  );
}

function filterTableRows({
  rowIds,
  headers,
  cellsById,
  inputValue,
  // @ts-ignore `getCellId` is not in the types, but present in Carbon.
  getCellId,
}: FilterRowsData) {
  return rowIds.filter((rowId) =>
    headers.some(({ key }) => {
      const cellId = getCellId(rowId, key);
      const value = cellsById[cellId].value;
      const filterableValue =
        value?.filterableValue?.toString() ?? value?.toString() ?? "";
      return filterableValue.toLowerCase().includes(inputValue.toLowerCase());
    })
  );
}

export default OfflineActionsTable;
