type ConditionalSimplifyDeep<Type, ExcludeType = never, IncludeType = unknown> = Type extends ExcludeType
  ? Type
  : Type extends IncludeType
    ? { [TypeKey in keyof Type]: ConditionalSimplifyDeep<Type[TypeKey], ExcludeType, IncludeType> }
    : Type

type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {}

type SimplifyDeep<Type> = ConditionalSimplifyDeep<Type, () => any | Iterable<unknown>, object>
