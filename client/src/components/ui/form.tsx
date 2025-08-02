import * as React from &apos;react&apos;;
import * as LabelPrimitive from &apos;@radix-ui/react-label&apos;;
import { Slot } from &apos;@radix-ui/react-slot&apos;;
import {
  Controller,
  ControllerProps,
  FieldPath,
  FieldValues,
  FormProvider,
  useFormContext
} from &apos;react-hook-form&apos;;

import { cn } from &apos;@/lib/utils&apos;;
import { Label } from &apos;@/components/ui/label&apos;;

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  _name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ _name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error(&apos;useFormField should be used within <FormField>&apos;);
  }

  const { id } = itemContext;

  return {
    id,
    _name: fieldContext.name,
    _formItemId: `${id}-form-item`,
    _formDescriptionId: `${id}-form-item-description`,
    _formMessageId: `${id}-form-item-message`,
    ...fieldState
  };
};

type FormItemContextValue = {
  _id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn(&apos;space-y-2&apos;, className)} {...props} />
    </FormItemContext.Provider>
  );
});
FormItem.displayName = &apos;FormItem&apos;;

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      ref={ref}
      className={cn(error && &apos;text-destructive&apos;, className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = &apos;FormLabel&apos;;

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = &apos;FormControl&apos;;

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn(&apos;text-sm text-muted-foreground&apos;, className)}
      {...props}
    />
  );
});
FormDescription.displayName = &apos;FormDescription&apos;;

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn(&apos;text-sm font-medium text-destructive&apos;, className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = &apos;FormMessage&apos;;

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField
};
