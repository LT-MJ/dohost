import { prisma } from "@hostpanel/db";
import { format } from "@hostpanel/shared/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffActor } from "@/lib/session";
import { CreateGroupForm, CreateProductForm } from "./product-forms";

export default async function AdminProductsPage() {
  await requireStaffActor();
  const groups = await prisma.productGroup.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: { products: { where: { deletedAt: null }, include: { prices: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>

      <Card>
        <CardHeader>
          <CardTitle>New product group</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateGroupForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New product</CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a product group first.</p>
          ) : (
            <CreateProductForm groups={groups} />
          )}
        </CardContent>
      </Card>

      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle>{group.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.products.map((product) => {
              const currentPrice = product.prices.find((p) => p.effectiveTo === null && p.billingCycle === "MONTHLY");
              return (
                <div key={product.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span>{product.name}</span>
                  <span className="text-muted-foreground">{product.description}</span>
                  <span>{currentPrice ? format({ amount: currentPrice.price, currency: currentPrice.currency }) : "—"}</span>
                  <Badge variant={product.status === "ACTIVE" ? "default" : "outline"}>{product.status}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
