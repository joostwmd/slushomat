"use client";

import * as React from "react";

import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";
import { cn } from "@slushomat/ui/lib/utils";

const selectClassName = cn(
  "h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:text-xs dark:bg-input/30",
);

export type BusinessEntityFormValues = {
  name: string;
  legalName: string;
  legalForm: string;
  vatId: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
};

export interface BusinessEntityFormProps {
  value: BusinessEntityFormValues;
  onChange: (next: BusinessEntityFormValues) => void;
  disabled?: boolean;
  idPrefix?: string;
  className?: string;
}

export function BusinessEntityForm({
  value,
  onChange,
  disabled = false,
  idPrefix = "business-entity",
  className,
}: BusinessEntityFormProps) {
  const patch = (partial: Partial<BusinessEntityFormValues>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          disabled={disabled}
          autoComplete="organization"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-legal-name`}>Legal name</Label>
        <Input
          id={`${idPrefix}-legal-name`}
          value={value.legalName}
          onChange={(e) => patch({ legalName: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-legal-form`}>Legal form</Label>
          <Input
            id={`${idPrefix}-legal-form`}
            value={value.legalForm}
            onChange={(e) => patch({ legalForm: e.target.value })}
            disabled={disabled}
            placeholder="e.g. GmbH"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-vat`}>VAT ID</Label>
          <Input
            id={`${idPrefix}-vat`}
            value={value.vatId}
            onChange={(e) => patch({ vatId: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-street`}>Street</Label>
        <Input
          id={`${idPrefix}-street`}
          value={value.street}
          onChange={(e) => patch({ street: e.target.value })}
          disabled={disabled}
          autoComplete="street-address"
        />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-postal`}>Postal code</Label>
          <Input
            id={`${idPrefix}-postal`}
            value={value.postalCode}
            onChange={(e) => patch({ postalCode: e.target.value })}
            disabled={disabled}
            autoComplete="postal-code"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
            disabled={disabled}
            autoComplete="address-level2"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-country`}>Country</Label>
        <select
          id={`${idPrefix}-country`}
          className={selectClassName}
          value={value.country || "DE"}
          onChange={(e) => patch({ country: e.target.value })}
          disabled={disabled}
          autoComplete="country"
        >
          <option value="DE">Germany (DE)</option>
          <option value="AT">Austria (AT)</option>
          <option value="CH">Switzerland (CH)</option>
          <option value="NL">Netherlands (NL)</option>
          <option value="BE">Belgium (BE)</option>
          <option value="FR">France (FR)</option>
        </select>
      </div>
    </div>
  );
}
