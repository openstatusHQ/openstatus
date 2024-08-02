import React from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationLink
} from "@openstatus/ui";

export const ListPagination = ({ current, total }: { current: number, total: number }) => {
  return (
    <Pagination>
      <PaginationContent>
        {current > 1 ?
          <PaginationItem>
            <PaginationPrevious href={`?page=${current - 1}`} />
          </PaginationItem>
          : <div/>}
        {current - 1 >= 1 ?
          <PaginationLink href={`?page=${current - 1}`}>
            {current - 1}
          </PaginationLink>
          : <div/>}
        {total > 1 ?
          <PaginationLink href={`?page=${current}`} isActive>
            {current}
          </PaginationLink>
          : <div/>}
        {current < total ?
          <PaginationLink href={`?page=${current + 1}`}>
            {current + 1}
          </PaginationLink>
          : <div/>}
        {total > 1 ?
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          : <div/>}
        {current < total ?
          <PaginationItem >
            <PaginationNext href={`?page=${current + 1}`} />
          </PaginationItem>
          : <div/>}
      </PaginationContent>
    </Pagination>
  )
}

