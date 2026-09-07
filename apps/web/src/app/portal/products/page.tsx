import { listPublicCatalog } from "@hostpanel/core";
import { format } from "@hostpanel/shared/money";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClientActor } from "@/lib/session";
import { OrderForm } from "./order-form";

export default async function ProductsPage() {
  const actor = await requireClientActor();
  const catalog = await listPublicCatalog(actor.tenantId, "USD");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground">Choose a plan to add to your account.</p>
      </div>

      {catalog.map(({ group, products }) => (
        <div key={group.id} className="space-y-4">
          <h2 className="text-lg font-medium">{group.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(({ product, monthlyPrice }) => (
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle>{product.name}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {monthlyPrice ? format({ amount: monthlyPrice.price, currency: monthlyPrice.currency }) : "—"}
                    <span className="text-sm font-normal text-muted-foreground"> /mo</span>
                  </p>
                </CardContent>
                <CardFooter>
                  {monthlyPrice ? (
                    <OrderForm productId={product.id} label={`Order ${product.name}`} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Not currently available.</p>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
